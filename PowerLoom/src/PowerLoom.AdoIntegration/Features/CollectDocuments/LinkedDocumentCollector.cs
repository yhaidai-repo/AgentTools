using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Infrastructure.Attachments;
using PowerLoom.Infrastructure.Attachments.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.CollectDocuments;

// The PBI's linked documents not handled yet, from its description, acceptance criteria and its files attached in ADO,
// plus the ADO attachments its discussion and the team's own text fields show (images pasted into a comment):
// an ADO attachment is downloaded with the vault's token and stored as the PBI's attachment; a failed download, and a
// web page when asked for, become the user's task. Returns how many documents changed.
public sealed class LinkedDocumentCollector(PowerLoomDbContext db, AdoSettingsStore settings, IAdoClientFactory clients, ILogger<LinkedDocumentCollector> logger)
{
    public async Task<int> CollectAsync(string vault, int adoId, bool askForWebPages, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => new { row.DescriptionMd, row.AcceptanceCriteriaMd, row.AttachedFiles, row.DiscussionMd, row.ExtraFieldsMd }).SingleOrDefaultAsync(cancellation);

        if (pbi is null)
            return 0;

        var handled = await DocumentTasks.HandledUrlsAsync(db, adoId, cancellation);
        var linked = UrlText.PbiLinkedUrls(pbi.DescriptionMd, pbi.AcceptanceCriteriaMd)
            .Concat(AttachedFileUrls(pbi.AttachedFiles))
            .Concat(AdoAttachmentsIn(pbi.DiscussionMd, pbi.ExtraFieldsMd))
            .Distinct();
        var missing = linked.Where(url => !handled.Contains(url) && IsCollected(url, askForWebPages)).ToList();
        var changed = 0;

        foreach (var url in missing)
            changed += await CollectOneAsync(vault, adoId, url, cancellation) ? 1 : 0;

        return changed;
    }

    private static IEnumerable<string> AttachedFileUrls(string? attachedFiles)
    {
        return attachedFiles is null ? [] : JsonSerializer.Deserialize<List<string>>(attachedFiles) ?? [];
    }

    // Only ADO attachments: a web link in a comment is chat, not a document the PBI depends on, so it never becomes a task.
    private static IEnumerable<string> AdoAttachmentsIn(string? discussionMd, string? extraFieldsMd)
    {
        return UrlText.PbiLinkedUrls(discussionMd, extraFieldsMd).Where(url => LinkedDocuments.KindOf(url) == LinkedDocuments.AdoAttachment);
    }

    // Confluence pages are SyncPbiPages'; a web page only for an agent without web access (user decision 2026-10-14).
    private static bool IsCollected(string url, bool askForWebPages)
    {
        return LinkedDocuments.KindOf(url) switch
        {
            LinkedDocuments.Confluence => false,
            LinkedDocuments.Web => askForWebPages,
            _ => true,
        };
    }

    private async Task<bool> CollectOneAsync(string vault, int adoId, string url, CancellationToken cancellation)
    {
        if (LinkedDocuments.KindOf(url) != LinkedDocuments.AdoAttachment)
            return await DocumentTasks.CreateAsync(db, adoId, url, null, cancellation) is not null;

        var problem = await DownloadAsync(vault, adoId, url, cancellation);

        if (problem is null)
            return true;

        logger.LogWarning("documents PBI-{AdoId}: {Url} not fetched ({Problem})", adoId, url, problem);

        return await DocumentTasks.CreateAsync(db, adoId, url, problem, cancellation) is not null;
    }

    // Why the attachment couldn't be stored, or null when it was; the reason goes into the user's task.
    private async Task<string?> DownloadAsync(string vault, int adoId, string url, CancellationToken cancellation)
    {
        var ado = await settings.ReadAdoAsync(vault, cancellation);

        if (ado is null || !ado.IsConfigured)
            return $"ADO settings are not configured for {vault}";

        try
        {
            var file = await clients.For(new AdoConnection(ado.OrgUrl, ado.Project, ado.Team, ado.Pat)).DownloadAttachmentAsync(url, cancellation);
            var stored = await AttachmentStore.StoreAsync(db, [new UploadedFile(file.FileName, file.ContentType, file.Bytes)], new AttachmentTarget(adoId, null, url, AttachmentOrigin.Ado), cancellation);

            return stored.Ok ? null : stored.Problem!.Detail;
        }
        catch (Exception error) when (error is AdoRequestException or HttpRequestException)
        {
            return error.Message;
        }
    }
}
