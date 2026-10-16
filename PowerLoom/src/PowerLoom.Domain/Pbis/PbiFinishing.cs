using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Finishes the PBI in PowerLoom only (ADO untouched). Its open agent tasks are cancelled so no agent works on it again; the
// user's questions, human tasks and findings stay as they are (user decision 2026-10-05). Its child items are finished
// with it (user decision 2026-10-13): a finished PBI leaves no open child behind for the agents.
public static class PbiFinishing
{
    // Already finished, or closed in ADO. A PBI that was never prepared can be finished too (user decision 2026-10-13:
    // e.g. a parent whose bug children were the work).
    private static readonly PipelineStatus[] Unfinishable = [PipelineStatus.Done, PipelineStatus.Closed];

    // A child that is over already keeps its status; any other child, prepared or not, is finished with its parent.
    private static readonly PipelineStatus[] Settled = [PipelineStatus.Done, PipelineStatus.Closed];

    public static bool IsFinishable(PipelineStatus status) => !Unfinishable.Contains(status);

    public static async Task<Outcome<string>> FinishAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return Outcome<string>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

        var children = await OpenChildrenAsync(db, adoId, cancellation);
        var problem = await ProblemAsync(db, pbi, children, cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        var cancelled = 0;

        foreach (var item in children.Prepend(pbi))
            cancelled += await FinishOneAsync(db, item, actor, cancellation);

        await db.SaveChangesAsync(cancellation);

        return Outcome<string>.Success(Summary(adoId, children.Count, cancelled));
    }

    private static Task<List<WorkItem>> OpenChildrenAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        return db.WorkItems.Where(row => row.ParentId == adoId && !Settled.Contains(row.PipelineStatus)).ToListAsync(cancellation);
    }

    // The PBI must be finishable, and no run may work on it or on a child about to be finished with it.
    private static async Task<string?> ProblemAsync(PowerLoomDbContext db, WorkItem pbi, List<WorkItem> children, CancellationToken cancellation)
    {
        if (!IsFinishable(pbi.PipelineStatus))
            return $"PBI-{pbi.AdoId} is {new KebabCaseNameTranslator().TranslateMemberName(pbi.PipelineStatus.ToString())}.";

        var running = await PbiChildren.RunningRunOnAnyAsync(db, children.Select(child => child.AdoId).Prepend(pbi.AdoId).ToList(), cancellation);

        return running is null ? null : $"RUN-{running.Id} is working on PBI-{running.PbiId}; finish it when the run has ended.";
    }

    // Done, and its open agent tasks cancelled; returns how many tasks were cancelled.
    private static async Task<int> FinishOneAsync(PowerLoomDbContext db, WorkItem item, string actor, CancellationToken cancellation)
    {
        var cancelled = await CancelAgentTasksAsync(db, item.AdoId, actor, cancellation);

        PbiStatusChange.Set(db, item, item.PipelineStatus, PipelineStatus.Done, actor, null);

        return cancelled;
    }

    private static async Task<int> CancelAgentTasksAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var open = await db.LocalItems.Where(item => item.PbiId == adoId && item.Assignee.StartsWith("agent:") && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress)).ToListAsync(cancellation);

        foreach (var task in open)
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, actor, null, cancellation);

        return open.Count;
    }

    private static string Summary(int adoId, int children, int cancelled)
    {
        var childPart = children > 0 ? $"; {children} child item(s) done" : "";
        var taskPart = cancelled > 0 ? $"; {cancelled} agent task(s) cancelled" : "";

        return $"PBI-{adoId} done{childPart}{taskPart}.";
    }
}
