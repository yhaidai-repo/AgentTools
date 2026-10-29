using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Confluence;
using PowerLoom.Contracts.Documents;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;

namespace PowerLoom.Features.Pbis.Prepare;

// Writes the note from the vault template and queues a task of the message's stage (refinement, or design for the planning
// agent), also for a PBI already in the pipeline (a re-refinement). Then the status follows the new task and every note
// is rendered (PbiChanged).
public static class PreparePbiHandler
{
    // Statuses sync sets that the pipeline can't derive from tasks; prepare takes the PBI out of them.
    private static readonly PipelineStatus[] NotInPipeline = [PipelineStatus.New, PipelineStatus.Stale];

    public static async Task Handle(PreparePbi message, PowerLoomDbContext db, PbiNoteWriter notes, IMessageBus bus, ILogger<PreparePbi> logger, CancellationToken cancellation)
    {
        var stage = AgentStages.StageOfKind(message.TaskType);
        var row = await db.WorkItems.SingleOrDefaultAsync(item => item.AdoId == message.AdoId, cancellation);

        if (stage is null || row is null)
        {
            logger.LogWarning("prepare PBI-{AdoId} for {TaskType}: no such PBI or pipeline stage", message.AdoId, message.TaskType);

            return;
        }

        var status = NotInPipeline.Contains(row.PipelineStatus) ? stage.Waiting : row.PipelineStatus;

        await notes.WritePbiAsync(row, status, cancellation);

        if (status != row.PipelineStatus)
        {
            PbiStatusChange.Set(db, row, row.PipelineStatus, status, message.Actor, null);
            await db.SaveChangesAsync(cancellation);
        }

        var taskId = await AgentTasks.EnsureAsync(db, stage.Kind, message.AdoId, null, cancellation);

        await PbiStatusSync.RecalculateAsync(db, message.AdoId, message.Actor, cancellation);
        // Linked documents are collected and Confluence pages re-checked for a newer version (the ADO and Confluence
        // libraries); each renders the notes again when it changed something.
        await bus.PublishAsync(new CollectLinkedDocuments(message.Vault, message.AdoId));
        await bus.PublishAsync(new SyncPbiPages(message.Vault, message.AdoId, PageSyncScope.All));
        await bus.PublishAsync(new PbiChanged(message.Vault, message.AdoId));
        logger.LogInformation("prepare PBI-{AdoId}: {Task}", message.AdoId, taskId ?? $"{stage.Kind} task already open");
    }
}
