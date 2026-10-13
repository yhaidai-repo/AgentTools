using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// Deletes a PBI in PowerLoom only (ADO untouched, user decision 2026-10-02): its child items first (they belong to it, user
// decision 2026-10-09), then the PBI. Each is remembered so sync doesn't bring it back. The usage records stay.
public static class PbiDeletion
{
    // Why the PBI can't be deleted now: an agent run on it, or on a child item deleted with it, would write into rows
    // that are gone.
    public static async Task<string?> ProblemAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        foreach (var id in (await PbiChildren.ChildIdsAsync(db, adoId, cancellation)).Prepend(adoId))
        {
            var runId = await PbiChildren.RunningRunOnAsync(db, id, cancellation);

            if (runId is not null)
                return $"RUN-{runId} is working on PBI-{id}; delete it when the run has ended.";
        }

        return null;
    }

    // The deleted PBI's title.
    public static async Task<Outcome<string>> DeleteAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var problem = await ProblemAsync(db, adoId, cancellation);
        var title = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Title).SingleOrDefaultAsync(cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        if (title is null)
            return Outcome<string>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

        foreach (var childId in await PbiChildren.ChildIdsAsync(db, adoId, cancellation))
            await DeleteWorkItemAsync(db, childId, cancellation);

        await DeleteWorkItemAsync(db, adoId, cancellation);

        return Outcome<string>.Success(title);
    }

    // One work item with its bug record, tasks, questions, runs, attachments, repos, refinements and drafts.
    private static async Task DeleteWorkItemAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        var title = await db.WorkItems.Where(row => row.AdoId == adoId).Select(row => row.Title).SingleAsync(cancellation);
        var itemIds = await db.LocalItems.Where(item => item.PbiId == adoId).Select(item => item.Id).ToListAsync(cancellation);
        var pbiKey = adoId.ToString();

        await db.StatusHistories.Where(row => (row.EntityKind == EntityKind.Pbi && row.EntityId == pbiKey) || itemIds.Contains(row.EntityId)).ExecuteDeleteAsync(cancellation);
        await db.Bugs.Where(row => row.WorkItemId == adoId).ExecuteDeleteAsync(cancellation);
        await db.Attachments.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.PbiRepos.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.TestCases.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.VaultCaptures.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.Refinements.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.Designs.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        // Its WWW records stay: they are in the vault log.
        await db.PbiFeedbacks.Where(row => row.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await ReleaseRunsAsync(db, adoId, itemIds, cancellation);
        await db.AgentRuns.Where(run => run.PbiId == adoId || (run.ItemId != null && itemIds.Contains(run.ItemId))).ExecuteDeleteAsync(cancellation);
        await db.LocalItems.Where(item => item.PbiId == adoId).ExecuteDeleteAsync(cancellation);
        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteDeleteAsync(cancellation);
        await RememberAsync(db, adoId, title, cancellation);
        await transaction.CommitAsync(cancellation);
    }

    // Items and status rows elsewhere may point at this PBI's runs (created_by_run, run_id): they let go first.
    private static async Task ReleaseRunsAsync(PowerLoomDbContext db, int adoId, List<string> itemIds, CancellationToken cancellation)
    {
        var runIds = await db.AgentRuns.Where(run => run.PbiId == adoId || (run.ItemId != null && itemIds.Contains(run.ItemId))).Select(run => run.Id).ToListAsync(cancellation);

        if (runIds.Count == 0)
            return;

        await db.LocalItems.Where(item => item.CreatedByRun != null && runIds.Contains(item.CreatedByRun.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CreatedByRun, (long?)null), cancellation);
        await db.StatusHistories.Where(row => row.RunId != null && runIds.Contains(row.RunId.Value)).ExecuteUpdateAsync(set => set.SetProperty(row => row.RunId, (long?)null), cancellation);
    }

    private static async Task RememberAsync(PowerLoomDbContext db, int adoId, string title, CancellationToken cancellation)
    {
        var remembered = await db.DeletedPbis.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (remembered is null)
            db.DeletedPbis.Add(remembered = new DeletedPbi { AdoId = adoId });

        remembered.Title = title;
        remembered.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }
}
