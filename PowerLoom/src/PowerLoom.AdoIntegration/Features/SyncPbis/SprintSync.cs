using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// One run over the vault's sprint. The sprint's PBIs plus every PBI already in the vault, minus those deleted in PowerLoom: a
// PBI stays until the user deletes it (user decision 2026-10-02) and keeps being refreshed so ADO changes (content,
// Done/Removed) still reach it. The scope has no status filter (user decision 2026-10-09).
public sealed class SprintSync(PowerLoomDbContext db, WorkItemStore store, SyncBookkeeping bookkeeping)
{
    public async Task<SyncOutcome> RunAsync(string vault, AdoSettings ado, SyncSettings settings, IAdoClient client, long runId, CancellationToken cancellation)
    {
        var scope = await ScopeLoader.LoadAsync(client, ado, settings, cancellation);

        if (scope is null)
            return new SyncOutcome(RunOutcome.NoOp, $"Sprint \"{settings.Sprint}\" not found in the team's iterations");

        var changed = await SyncWorkItemsAsync(vault, runId, scope, settings, client, cancellation);
        var newBugs = await SyncSprintBugsAsync(vault, runId, scope, client, cancellation);

        if (scope.Sprint.TimeFrame == "current")
        {
            await bookkeeping.SaveCurrentSprintAsync(vault, scope.Sprint.Path, cancellation);
            await bookkeeping.SnapshotSprintAsync(scope.Sprint.Path, scope.ChildEffort, cancellation);
        }

        return new SyncOutcome(RunOutcome.Success, $"{scope.Sprint.Name}: {scope.AllIds.Count} PBIs and {scope.BugIds.Count} bugs from your sprint tasks, {changed + newBugs} changed");
    }

    private async Task<int> SyncWorkItemsAsync(string vault, long runId, SyncScope scope, SyncSettings settings, IAdoClient client, CancellationToken cancellation)
    {
        var ids = await SyncedIdsAsync(vault, scope, cancellation);
        var window = SyncWindow.Select(ids, await bookkeeping.ReadCursorAsync(vault, cancellation), settings.MaxItemsPerRun);
        var fetched = await client.GetWorkItemsAsync(window.Ids, AdoFields.Every, cancellation);
        var changed = await store.UpsertAsync(vault, runId, fetched.Select(WorkItemMapper.Map), cancellation);

        await bookkeeping.SaveCursorAsync(vault, window.NextCursor, cancellation);

        return changed;
    }

    private async Task<IReadOnlyList<int>> SyncedIdsAsync(string vault, SyncScope scope, CancellationToken cancellation)
    {
        var deleted = await bookkeeping.DeletedPbiIdsAsync(cancellation);
        // Local PBIs have no ADO counterpart to refresh.
        var kept = await db.WorkItems.AsNoTracking().Where(item => item.Vault == vault && item.Source == WorkItemSource.Ado).Select(item => item.AdoId).ToListAsync(cancellation);

        return scope.AllIds.Concat(kept).Distinct().Where(id => !deleted.Contains(id)).Order().ToList();
    }

    // The scope's [BUG] Tasks: only new bugs are fetched here, known ones are refreshed with the vault's other items. A
    // bug's parent comes first when the PBI window hasn't brought it yet, so the bug always finds it. A parent the user
    // deleted stays deleted; its bugs come in unlinked.
    private async Task<int> SyncSprintBugsAsync(string vault, long runId, SyncScope scope, IAdoClient client, CancellationToken cancellation)
    {
        var known = (await db.WorkItems.AsNoTracking().Select(item => item.AdoId).ToListAsync(cancellation)).ToHashSet();
        var skipped = known.Union(await bookkeeping.DeletedPbiIdsAsync(cancellation)).ToHashSet();
        var newIds = scope.BugIds.Where(id => !skipped.Contains(id)).ToList();

        if (newIds.Count == 0)
            return 0;

        var bugs = (await client.GetWorkItemsAsync(newIds, AdoFields.Every, cancellation)).Select(WorkItemMapper.Map).ToList();
        var parentIds = bugs.Select(bug => bug.AdoParentId).Where(id => id is not null && !skipped.Contains(id.Value)).Select(id => id!.Value).Distinct().ToList();
        var parents = parentIds.Count == 0 ? [] : (await client.GetWorkItemsAsync(parentIds, AdoFields.Every, cancellation)).Select(WorkItemMapper.Map).ToList();

        return await store.UpsertAsync(vault, runId, parents, cancellation) + await store.UpsertAsync(vault, runId, bugs, cancellation);
    }
}
