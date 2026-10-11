using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Confluence;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;

namespace PowerLoom.Features.Pbis.Prepare;

// Writes the note from the vault template and queues a refinement task, also for a PBI already in the pipeline (a
// re-refinement). Then the status follows the new task and every note is rendered (PbiChanged).
public static class PreparePbiHandler
{
    // Statuses sync sets that the pipeline can't derive from tasks; prepare takes the PBI out of them.
    private static readonly PipelineStatus[] NotInPipeline = [PipelineStatus.New, PipelineStatus.Stale];

    public static async Task Handle(PreparePbi message, PowerLoomDbContext db, PbiNoteWriter notes, IMessageBus bus, ILogger<PreparePbi> logger, CancellationToken cancellation)
    {
        var row = await db.WorkItems.SingleOrDefaultAsync(item => item.AdoId == message.AdoId, cancellation);

        if (row is null)
        {
            logger.LogWarning("prepare PBI-{AdoId}: not in adoa", message.AdoId);

            return;
        }

        var status = NotInPipeline.Contains(row.PipelineStatus) ? PipelineStatus.ReadyForRefinement : row.PipelineStatus;

        await notes.WritePbiAsync(row, status, cancellation);

        if (status != row.PipelineStatus)
        {
            PbiStatusChange.Set(db, row, row.PipelineStatus, status, message.Actor, null);
            await db.SaveChangesAsync(cancellation);
        }

        var taskId = await AgentTasks.EnsureAsync(db, AgentStages.Refinement, message.AdoId, null, cancellation);

        await PbiStatusSync.RecalculateAsync(db, message.AdoId, message.Actor, cancellation);
        // Linked Confluence pages are re-checked for a newer version (the Confluence library, when loaded).
        await bus.PublishAsync(new SyncPbiPages(message.Vault, message.AdoId, PageSyncScope.All));
        await bus.PublishAsync(new PbiChanged(message.Vault, message.AdoId));
        logger.LogInformation("prepare PBI-{AdoId}: {Task}", message.AdoId, taskId ?? "refinement task already open");
    }
}
