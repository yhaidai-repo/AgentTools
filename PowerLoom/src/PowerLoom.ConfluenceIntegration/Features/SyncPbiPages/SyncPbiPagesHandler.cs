using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Confluence;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using Wolverine;

namespace PowerLoom.ConfluenceIntegration.Features.Pages;

// The Confluence pages a PBI links: "missing" fetches only links without a fetched copy (first fetch or a retry);
// "all" also checks the version of the copies and replaces them when the page changed. On the vault's queue; the
// PBI's notes follow when something changed.
public static class SyncPbiPagesHandler
{
    public static async Task Handle(SyncPbiPages message, PowerLoomDbContext db, PageSync sync, IMessageBus bus, ILogger<SyncPbiPages> logger, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == message.AdoId).Select(row => new { row.DescriptionMd, row.AcceptanceCriteriaMd }).SingleOrDefaultAsync(cancellation);

        if (pbi is null)
            return;

        var links = UrlText.PbiLinkedUrls(pbi.DescriptionMd, pbi.AcceptanceCriteriaMd).Where(url => LinkedDocuments.KindOf(url) == LinkedDocuments.Confluence).ToList();
        var changed = false;

        foreach (var url in links)
            changed |= await SyncLinkAsync(message, url, sync, cancellation);

        logger.LogInformation("confluence PBI-{AdoId} ({Scope}): {Count} page link(s), {Changed}", message.AdoId, message.Scope, links.Count, changed ? "changed" : "unchanged");

        if (changed)
            await bus.PublishAsync(new PbiChanged(message.Vault, message.AdoId));
    }

    private static async Task<bool> SyncLinkAsync(SyncPbiPages message, string url, PageSync sync, CancellationToken cancellation)
    {
        var copies = await sync.FetchedCopiesAsync(message.AdoId, url, cancellation);

        if (message.Scope == PageSyncScope.Missing && copies.Count > 0)
            return false;

        return await sync.SyncPageAsync(message.Vault, message.AdoId, url, copies, cancellation);
    }
}
