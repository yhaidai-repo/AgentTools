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

// The PBI's linked documents not handled yet: an ADO attachment is downloaded with the vault's token and stored as the
// PBI's attachment; a web page, and a failed download, become the user's task. Returns how many documents changed.
public sealed class LinkedDocumentCollector(PowerLoomDbContext db, AdoSettingsStore settings, IAdoClientFactory clients, ILogger<LinkedDocumentCollector> logger)
{
    public async Task<int> CollectAsync(string vault, int adoId, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => new { row.DescriptionMd, row.AcceptanceCriteriaMd }).SingleOrDefaultAsync(cancellation);

        if (pbi is null)
            return 0;

        var handled = await DocumentTasks.HandledUrlsAsync(db, adoId, cancellation);
        var missing = UrlText.PbiLinkedUrls(pbi.DescriptionMd, pbi.AcceptanceCriteriaMd).Where(url => !handled.Contains(url) && LinkedDocuments.KindOf(url) != LinkedDocuments.Confluence).ToList();
        var changed = 0;

        foreach (var url in missing)
            changed += await CollectOneAsync(vault, adoId, url, cancellation) ? 1 : 0;

        return changed;
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
