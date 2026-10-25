using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// "Re-run" on a finished agent task (user decision 2026-10-02), or on one that failed and waits for another attempt
// (user request 2026-10-25: a run that failed on a bug that is fixed now starts afresh, its attempts not used up): back
// to open with a fresh start (attempts, held reasons, hand-on reset); the dispatcher runs it on the agent's next dispatch
// or "Run now", after the usual checks.
// Its next run continues the last run's conversation when that run didn't succeed, unless `startOver` is asked
// (user decision 2026-10-19).
public static class TaskRerun
{
    private const string Actor = "human";
    private const string EmptyHeldBy = "[]";

    public static bool IsRerunnable(LocalItem item) => IsAgentTask(item) && (item.Status is ItemStatus.Done or ItemStatus.Blocked || HasFailed(item));

    private static bool IsAgentTask(LocalItem item) => AgentStages.AgentIdOf(item.Assignee) is not null && item.Kind != ItemKinds.ResearchResult;

    // Open again after a failed run (an attempt counted) or held with a reason (a rate limit, a check that failed).
    private static bool HasFailed(LocalItem item) => item.Status == ItemStatus.Open && (item.Attempts > 0 || item.HeldBy != EmptyHeldBy);

    public static async Task<Outcome<string>> RerunAsync(PowerLoomDbContext db, int? adoId, string itemId, bool startOver, CancellationToken cancellation)
    {
        var task = await ItemScope.FindAsync(db, adoId, itemId, cancellation);

        if (task is null || !IsRerunnable(task))
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} isn't a finished or failed agent task of {ItemScope.PbiLabel(adoId)}."));

        task.Attempts = 0;
        task.HeldBy = EmptyHeldBy;
        task.HandedOnAt = null;
        task.StartOver = startOver;

        await ItemStatusChange.SetAsync(db, task, ItemStatus.Open, Actor, null, cancellation);

        return Outcome<string>.Success(task.Id);
    }
}
