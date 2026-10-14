using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// After each sync, every work item whose rev moved since its discussion was read (a new ADO comment is a new revision too)
// gets its discussion read again, and a prepared PBI's notes are rendered again, so every ADO change reaches the note
// agents read (user decision 2026-10-14). At most maxItems per run; the rest follow in the next run.
public sealed class DiscussionSync(PowerLoomDbContext db, IMessageBus bus)
{
    // ADO returns at most 200 comments per call; older ones of a longer discussion are left out.
    private const int CommentLimit = 200;

    public async Task<int> RunAsync(string vault, IAdoClient client, int maxItems, CancellationToken cancellation)
    {
        var moved = await db.WorkItems
            .Where(row => row.Vault == vault && row.Source == WorkItemSource.Ado && row.DiscussionRev != row.Rev)
            .OrderBy(row => row.AdoId)
            .Take(maxItems)
            .ToListAsync(cancellation);

        foreach (var row in moved)
            await ReadDiscussionAsync(row, client, cancellation);

        await db.SaveChangesAsync(cancellation);
        await RenderPreparedNotesAsync(vault, moved);

        return moved.Count;
    }

    private static async Task ReadDiscussionAsync(WorkItem row, IAdoClient client, CancellationToken cancellation)
    {
        var comments = await CommentsAsync(row.AdoId, client, cancellation);

        row.DiscussionMd = DiscussionMarkdown.Render(comments);
        row.DiscussionRev = row.Rev;
    }

    // An item deleted in ADO keeps its mirror (the batch read omits it); it gets an empty discussion instead of failing
    // every run.
    private static async Task<IReadOnlyList<AdoComment>> CommentsAsync(int adoId, IAdoClient client, CancellationToken cancellation)
    {
        try
        {
            return await client.GetCommentsAsync(adoId, CommentLimit, cancellation);
        }
        catch (AdoRequestException error) when (error.Status == 404)
        {
            return [];
        }
    }

    private async Task RenderPreparedNotesAsync(string vault, IEnumerable<WorkItem> rows)
    {
        var prepared = rows.Where(row => row.VaultPath is not null);

        foreach (var row in prepared)
            await bus.PublishAsync(new PbiChanged(vault, row.AdoId));
    }
}
