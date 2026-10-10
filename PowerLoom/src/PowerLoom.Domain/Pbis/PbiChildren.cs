using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// A PBI's child work items (bugs, tasks under it); children stay one level deep (user decision 2026-10-09).
public static class PbiChildren
{
    public static Task<List<int>> ChildIdsAsync(PowerLoomDbContext db, int parentId, CancellationToken cancellation)
    {
        return db.WorkItems.AsNoTracking().Where(row => row.ParentId == parentId).Select(row => row.AdoId).ToListAsync(cancellation);
    }

    // The agent run working on the PBI now, if any.
    public static async Task<long?> RunningRunOnAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var running = await db.AgentRuns.AsNoTracking().Where(run => run.PbiId == adoId && run.Outcome == RunOutcome.Running).Select(run => run.Id).FirstOrDefaultAsync(cancellation);

        return running == 0 ? null : running;
    }
}
