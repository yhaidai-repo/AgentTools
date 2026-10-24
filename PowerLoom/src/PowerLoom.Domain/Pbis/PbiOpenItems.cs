using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// The items still waiting on a PBI that is over (done, closed, or gone to another team member) are cancelled, so nothing
// waits on anyone (user decision 2026-10-21). Findings stay open: they still go to the vault's registers. The item a run
// works on now is left to that run.
public static class PbiOpenItems
{
    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    // Returns how many items were cancelled.
    public static async Task<int> CancelAsync(PowerLoomDbContext db, int adoId, string actor, long? runId, CancellationToken cancellation)
    {
        var worked = db.AgentRuns.Where(run => run.Outcome == RunOutcome.Running && run.ItemId != null).Select(run => run.ItemId);
        var open = await db.LocalItems.Where(item => item.PbiId == adoId && Waiting.Contains(item.Status) && item.Kind != ItemKind.Finding && !worked.Contains(item.Id)).ToListAsync(cancellation);

        foreach (var item in open)
            await ItemStatusChange.SetAsync(db, item, ItemStatus.Cancelled, actor, runId, cancellation);

        return open.Count;
    }
}
