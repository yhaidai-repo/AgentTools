using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.ConfluenceIntegration.Client.Models;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Infrastructure.Attachments;
using PowerLoom.Infrastructure.Attachments.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.ConfluenceIntegration.Features.Pages;

// One linked page brought up to date (adoa's confluencePages): stored as the PBI's attachments for that link, with its
// readable files. Without a usable copy, a failure becomes the user's task with the reason; with one, the copy stays
// and the failure is logged (the agents keep reading the last fetched version). True when something changed.
public sealed partial class PageSync(PowerLoomDbContext db, IConfluenceClientFactory clients, BacklogFiles files, ILogger<PageSync> logger)
{
    private const string NotSetUp = "Confluence isn't set up: Confluence:Email and Confluence:ApiToken (PowerLoom)";

    public Task<List<Attachment>> FetchedCopiesAsync(int adoId, string url, CancellationToken cancellation)
    {
        return db.Attachments.Where(row => row.PbiId == adoId && row.SourceUrl == url && row.Origin == AttachmentOrigin.Confluence).ToListAsync(cancellation);
    }

    public async Task<bool> SyncPageAsync(string vault, int adoId, string url, List<Attachment> copies, CancellationToken cancellation)
    {
        try
        {
            return await FetchPageAsync(vault, adoId, url, copies, cancellation);
        }
        catch (Exception error) when (error is ConfluenceRequestException or HttpRequestException or InvalidOperationException)
        {
            return await ReportFailureAsync(adoId, url, copies, error.Message, cancellation);
        }
    }

    private async Task<bool> FetchPageAsync(string vault, int adoId, string url, List<Attachment> copies, CancellationToken cancellation)
    {
        var client = clients.Create() ?? throw new InvalidOperationException(NotSetUp);
        var page = await client.PageAsync(url, cancellation);
        var changed = copies.All(copy => copy.SourceVersion != page.Version);

        if (changed)
        {
            await StorePageAsync(client, adoId, url, page, cancellation);
            await RemoveCopiesAsync(vault, copies, cancellation);
        }

        await DocumentTasks.ResolveAsync(db, adoId, url, $"Fetched from Confluence (v{page.Version}).", cancellation);

        return changed;
    }

    // The page first, then its readable files; a file that can't be stored is logged and skipped, the page still
    // counts.
    private async Task StorePageAsync(IConfluenceClient client, int adoId, string url, ConfluencePage page, CancellationToken cancellation)
    {
        var target = new AttachmentTarget(adoId, null, url, AttachmentOrigin.Confluence, page.Version);
        var stored = await AttachmentStore.StoreAsync(db, [new UploadedFile($"{FileSafe(page.Title)}.html", "text/html", Encoding.UTF8.GetBytes(page.Html))], target, cancellation);

        if (!stored.Ok)
            throw new InvalidOperationException($"the page couldn't be stored: {stored.Problem!.Detail}");

        foreach (var file in (await client.FilesAsync(url, cancellation)).Where(IsReadable))
            await StoreFileAsync(client, file, target, cancellation);
    }

    private async Task StoreFileAsync(IConfluenceClient client, ConfluenceFile file, AttachmentTarget target, CancellationToken cancellation)
    {
        try
        {
            var downloaded = await client.DownloadAsync(file, cancellation);
            var stored = await AttachmentStore.StoreAsync(db, [new UploadedFile(downloaded.FileName, downloaded.ContentType, downloaded.Bytes)], target, cancellation);

            if (!stored.Ok)
                logger.LogWarning("confluence: PBI-{AdoId} {File} skipped: {Reason}", target.AdoId, file.FileName, stored.Problem!.Detail);
        }
        catch (Exception error) when (error is ConfluenceRequestException or HttpRequestException)
        {
            logger.LogWarning("confluence: PBI-{AdoId} {File} skipped: {Reason}", target.AdoId, file.FileName, error.Message);
        }
    }

    private async Task<bool> ReportFailureAsync(int adoId, string url, List<Attachment> copies, string reason, CancellationToken cancellation)
    {
        if (copies.Count > 0)
        {
            logger.LogWarning("confluence: PBI-{AdoId} kept the fetched copy of {Url}: {Reason}", adoId, url, reason);

            return false;
        }

        return await DocumentTasks.CreateAsync(db, adoId, url, reason, cancellation) is not null;
    }

    // Earlier fetched copies of the link: their rows and their files in the vault. The user's own uploads are never
    // touched.
    private async Task RemoveCopiesAsync(string vault, List<Attachment> copies, CancellationToken cancellation)
    {
        foreach (var copy in copies.Where(copy => copy.VaultPath is not null))
            files.Remove(vault, copy.VaultPath!);

        db.Attachments.RemoveRange(copies);
        await db.SaveChangesAsync(cancellation);
    }

    private static bool IsReadable(ConfluenceFile file)
    {
        return AttachmentLimits.ReadableExtensions.Contains(Path.GetExtension(file.FileName).ToLowerInvariant()) && file.SizeBytes <= AttachmentLimits.MaxBytes;
    }

    // Page titles become file names; characters Windows or Obsidian don't accept in names are replaced.
    private static string FileSafe(string title)
    {
        var safe = Spaces().Replace(UnsafeChars().Replace(title, " "), " ").Trim();

        return safe.Length == 0 ? "page" : safe[..Math.Min(safe.Length, 100)];
    }

    [GeneratedRegex(@"[\\/:*?""<>|#^\[\]]+")]
    private static partial Regex UnsafeChars();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
