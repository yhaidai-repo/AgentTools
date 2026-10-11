using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Finishes the PBI in adoa only (ADO untouched). Its open agent tasks are cancelled so no agent works on it again; the
// user's questions, human tasks and findings stay as they are (user decision 2026-10-05).
public static class PbiFinishing
{
    // Not prepared yet, already finished, or closed in ADO (user decision 2026-10-05: any prepared PBI can be finished).
    private static readonly PipelineStatus[] Unfinishable = [PipelineStatus.New, PipelineStatus.Done, PipelineStatus.Closed];

    public static bool IsFinishable(PipelineStatus status) => !Unfinishable.Contains(status);

    public static async Task<Outcome<string>> FinishAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return Outcome<string>.Failure(Problem.NotFound($"PBI-{adoId} isn't in adoa."));

        var problem = await ProblemAsync(db, pbi.AdoId, pbi.PipelineStatus, cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        var cancelled = await CancelAgentTasksAsync(db, adoId, actor, cancellation);

        PbiStatusChange.Set(db, pbi, pbi.PipelineStatus, PipelineStatus.Done, actor, null);
        await db.SaveChangesAsync(cancellation);

        return Outcome<string>.Success($"PBI-{adoId} done{(cancelled > 0 ? $"; {cancelled} agent task(s) cancelled" : "")}.");
    }

    private static async Task<string?> ProblemAsync(PowerLoomDbContext db, int adoId, PipelineStatus status, CancellationToken cancellation)
    {
        if (!IsFinishable(status))
            return $"PBI-{adoId} is {new KebabCaseNameTranslator().TranslateMemberName(status.ToString())}.";

        var runId = await PbiChildren.RunningRunOnAsync(db, adoId, cancellation);

        return runId is null ? null : $"RUN-{runId} is working on PBI-{adoId}; finish it when the run has ended.";
    }

    private static async Task<int> CancelAgentTasksAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var open = await db.LocalItems.Where(item => item.PbiId == adoId && item.Assignee.StartsWith("agent:") && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress)).ToListAsync(cancellation);

        foreach (var task in open)
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, actor, null, cancellation);

        return open.Count;
    }
}
