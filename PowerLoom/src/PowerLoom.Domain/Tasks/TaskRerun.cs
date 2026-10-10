using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// "Re-run" on a finished agent task (user decision 2026-10-02): back to open with a fresh start (attempts, held
// reasons, hand-on reset); the dispatcher runs it on the agent's next dispatch or "Run now", after the usual checks.
public static class TaskRerun
{
    private const string Actor = "human";

    public static bool IsRerunnable(LocalItem item) => AgentStages.AgentIdOf(item.Assignee) is not null && item.Kind != ItemKind.ResearchResult && item.Status is ItemStatus.Done or ItemStatus.Blocked;

    public static async Task<Outcome<string>> RerunAsync(PowerLoomDbContext db, int? adoId, string itemId, CancellationToken cancellation)
    {
        var task = await ItemScope.FindAsync(db, adoId, itemId, cancellation);

        if (task is null || !IsRerunnable(task))
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} isn't a finished agent task of {ItemScope.PbiLabel(adoId)}."));

        task.Attempts = 0;
        task.HeldBy = "[]";
        task.HandedOnAt = null;

        await ItemStatusChange.SetAsync(db, task, ItemStatus.Open, Actor, null, cancellation);

        return Outcome<string>.Success(task.Id);
    }
}
