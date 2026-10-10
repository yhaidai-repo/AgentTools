using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Items;

// Every pipeline status change goes through here so status_history stays complete (adoa's setPbiStatus).
public static class PbiStatusChange
{
    private static readonly KebabCaseNameTranslator Labels = new();

    public static void Set(PowerLoomDbContext db, WorkItem pbi, PipelineStatus? from, PipelineStatus to, string actor, long? runId)
    {
        pbi.PipelineStatus = to;
        db.StatusHistories.Add(new StatusHistory
        {
            EntityKind = EntityKind.Pbi,
            EntityId = pbi.AdoId.ToString(),
            FromStatus = from is null ? null : Labels.TranslateMemberName(from.ToString()!),
            ToStatus = Labels.TranslateMemberName(to.ToString()),
            Actor = actor,
            RunId = runId,
        });
    }
}
