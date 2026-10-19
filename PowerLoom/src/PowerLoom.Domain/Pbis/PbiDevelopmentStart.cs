using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Opening the chat that implements a PBI starts its development (user decision 2026-10-19), from any status before it.
// A PBI that is over keeps its status: only Finish, Close and the ADO sync move it there.
public static class PbiDevelopmentStart
{
    private static readonly PipelineStatus[] Kept = [PipelineStatus.Development, PipelineStatus.Done, PipelineStatus.Closed];

    public static async Task StartAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null || Kept.Contains(pbi.PipelineStatus))
            return;

        PbiStatusChange.Set(db, pbi, pbi.PipelineStatus, PipelineStatus.Development, actor, null);
        await db.SaveChangesAsync(cancellation);
    }
}
