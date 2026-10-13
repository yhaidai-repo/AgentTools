using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Tasks;

// Tasks for the pipeline agents (refinement, research, design) on a PBI.
public static class AgentTasks
{
    private const int TitleMax = 120;

    // A task of the agent's stage on a PBI, for any agent that handles its kind, unless one is open there. Returns its id,
    // or null when nothing was created (an open task of that kind exists, or the agent has no PBI stage).
    public static async Task<string?> EnsureAsync(PowerLoomDbContext db, string agentId, int adoId, long? createdByRun, CancellationToken cancellation)
    {
        if (!AgentStages.ByAgent.TryGetValue(agentId, out var stage) || await HasOpenTaskAsync(db, stage.Kind, adoId, cancellation))
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

    // After a successful task: the agent's configured next agent gets a task (user decision 2026-10-01). Marked as
    // handed on either way, so this happens once per task. The created task's id, or null.
    public static async Task<string?> HandOnAsync(PowerLoomDbContext db, LocalItem task, string? nextAgentId, CancellationToken cancellation)
    {
        var created = nextAgentId is not null && task.PbiId is not null ? await EnsureAsync(db, nextAgentId, task.PbiId.Value, null, cancellation) : null;

        task.HandedOnAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellation);

        return created;
    }

    private static Task<bool> HasOpenTaskAsync(PowerLoomDbContext db, ItemKind kind, int adoId, CancellationToken cancellation)
    {
        return db.LocalItems.AnyAsync(item => item.PbiId == adoId && item.Kind == kind && item.Assignee.StartsWith("agent:") && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress), cancellation);
    }
}
