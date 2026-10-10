using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Recalculates a PBI's status from its tasks after a change (adoa's syncPipelineStatus). Returns the new status, or
// null when it stayed.
public static class PbiStatusSync
{
    // Set by sync (new, stale, closed) or by the user (prepare; Finish → done), never derived.
    private static readonly PipelineStatus[] Fixed = [PipelineStatus.New, PipelineStatus.Development, PipelineStatus.Done, PipelineStatus.Stale, PipelineStatus.Closed];

    public static async Task<PipelineStatus?> RecalculateAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null || Fixed.Contains(pbi.PipelineStatus))
            return null;

        var items = await db.LocalItems.AsNoTracking().Where(item => item.PbiId == adoId).ToListAsync(cancellation);
        var next = PipelineStatusDerivation.Derive(items);

        if (next is null || next == pbi.PipelineStatus)
            return null;

        PbiStatusChange.Set(db, pbi, pbi.PipelineStatus, next.Value, actor, null);
        await db.SaveChangesAsync(cancellation);

        return next;
    }
}
