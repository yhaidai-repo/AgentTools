using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Tasks;

// Pipeline tasks on a PBI (prepare creates the refinement task; agents create the rest with create_task).
public static class AgentTasks
{
    private const int TitleMax = 120;

    // A pipeline task of this type on a PBI, for any agent that takes the type, unless one is open there. Returns its id,
    // or null when nothing was created (an open one exists, or the type has no pipeline stage).
    public static async Task<string?> EnsureAsync(PowerLoomDbContext db, string kind, int adoId, long? createdByRun, CancellationToken cancellation)
    {
        var stage = AgentStages.StageOfKind(kind);

        if (stage is null || await HasOpenTaskAsync(db, kind, adoId, cancellation))
            return null;

        var id = await ItemIds.NextAsync(db, stage.Prefix, adoId, cancellation);
        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleAsync(cancellation);

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Kind = stage.Kind,
            PbiId = adoId,
            Vault = vault,
            Title = stage.Title[..Math.Min(stage.Title.Length, TitleMax)],
            Status = ItemStatus.Open,
            Assignee = AgentStages.AnyAgent,
            CreatedByRun = createdByRun,
            HeldBy = "[]",
        });

        await db.SaveChangesAsync(cancellation);

        return id;
    }

    // The PBI's open or running agent task of this type, if any.
    public static Task<string?> OpenTaskIdAsync(PowerLoomDbContext db, string kind, int adoId, CancellationToken cancellation)
    {
        return OpenTasks(db, kind, adoId).Select(item => item.Id).FirstOrDefaultAsync(cancellation);
    }

    private static Task<bool> HasOpenTaskAsync(PowerLoomDbContext db, string kind, int adoId, CancellationToken cancellation)
    {
        return OpenTasks(db, kind, adoId).AnyAsync(cancellation);
    }

    private static IQueryable<LocalItem> OpenTasks(PowerLoomDbContext db, string kind, int adoId)
    {
        return db.LocalItems.Where(item => item.PbiId == adoId && item.Kind == kind && item.Assignee.StartsWith("agent:") && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress));
    }
}
