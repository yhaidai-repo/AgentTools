using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Flows.Engine;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;

namespace PowerLoom.Features.Flows;

// A flow's executions: started here with the definition as it is now (the engine creates the first nodes' tasks at once
// and the rest as their predecessors finish: FlowAdvancer), cancelled by the user (its waiting agent tasks with it; a
// running one finishes its run first, as a person's cancel works today).
public sealed class FlowExecutions(PowerLoomDbContext db, FlowAdvancer advancer, IMessageBus bus)
{
    private const string IdPrefix = "FX";
    private const string CancelActor = "human";

    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.Blocked];

    public async Task<Outcome<FlowExecution>> RunAsync(string flowId, RunFlowInput input, CancellationToken cancellation)
    {
        var flow = await db.Flows.AsNoTracking().SingleOrDefaultAsync(row => row.Id == flowId && row.Vault == input.Vault, cancellation);

        if (flow is null)
            return Failure(Problem.NotFound($"Flow {flowId} isn't in vault {input.Vault}."));

        var target = await TargetProblemAsync(input.Vault, input.Target, cancellation);

        if (target is not null)
            return Failure(target);

        var execution = new FlowExecution
        {
            Id = await ItemIds.NextGlobalAsync(db, IdPrefix, cancellation),
            FlowId = flow.Id,
            FlowVersion = flow.Version,
            Definition = flow.Definition,
            Vault = flow.Vault,
            TargetKind = input.Target.Kind,
            PbiId = input.Target.Kind == FlowTargetKinds.Pbi ? input.Target.PbiId : null,
            ItemId = input.Target.Kind == FlowTargetKinds.Task ? input.Target.ItemId : null,
            Status = FlowStatuses.Running,
            StartedAt = DateTime.UtcNow,
        };

        db.FlowExecutions.Add(execution);
        await db.SaveChangesAsync(cancellation);
        await advancer.AdvanceAsync(execution.Id, cancellation);

        return Outcome<FlowExecution>.Success(execution);
    }

    public async Task<Outcome<FlowExecution>> CancelAsync(string id, CancellationToken cancellation)
    {
        var execution = await db.FlowExecutions.SingleOrDefaultAsync(row => row.Id == id, cancellation);

        if (execution is null)
            return Failure(Problem.NotFound($"Execution {id} doesn't exist."));

        if (execution.Status != FlowStatuses.Running)
            return Failure(Problem.Conflict($"Execution {id} is already {execution.Status}."));

        execution.Status = FlowStatuses.Cancelled;
        execution.FinishedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellation);

        foreach (var task in await FlowExecutionTasks.LoadAllAsync(db, id, cancellation))
        {
            if (AgentStages.IsAgentTask(task.Assignee) && Waiting.Contains(task.Status) && task.Kind != ItemKinds.ResearchResult)
                await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, CancelActor, null, cancellation);
        }

        await PbiChanges.PublishAsync(db, bus, await FlowAdvancer.TargetPbiIdAsync(db, execution, cancellation), CancelActor, cancellation);

        return Outcome<FlowExecution>.Success(execution);
    }

    public async Task<FlowExecutionView> ViewAsync(FlowExecution row, CancellationToken cancellation)
    {
        var steps = await FlowSteps.ComputeAsync(db, row, cancellation);

        return new FlowExecutionView(row.Id, row.FlowId, row.FlowVersion, row.Vault, row.TargetKind, row.PbiId, row.ItemId, row.Status, row.Error, row.StartedAt, row.FinishedAt, FlowJson.Parse(row.Definition), steps);
    }

    // The target is a PBI or a task of the flow's vault (a deleted task doesn't count).
    private async Task<Problem?> TargetProblemAsync(string vault, FlowTargetInput target, CancellationToken cancellation)
    {
        switch (target.Kind)
        {
            case FlowTargetKinds.Pbi:
                if (target.PbiId is not { } pbiId)
                    return Problem.Invalid("A PBI target needs pbiId.");

                return await db.WorkItems.AnyAsync(pbi => pbi.AdoId == pbiId && pbi.Vault == vault, cancellation) ? null : Problem.NotFound($"PBI {pbiId} isn't in vault {vault}.");
            case FlowTargetKinds.Task:
                if (string.IsNullOrWhiteSpace(target.ItemId))
                    return Problem.Invalid("A task target needs itemId.");

                return await db.LocalItems.AnyAsync(item => item.Id == target.ItemId && item.Vault == vault && item.Status != ItemStatus.Deleted, cancellation) ? null : Problem.NotFound($"Task {target.ItemId} isn't in vault {vault}.");
            default:
                return Problem.Invalid($"Target kind \"{target.Kind}\" isn't \"{FlowTargetKinds.Pbi}\" or \"{FlowTargetKinds.Task}\".");
        }
    }

    private static Outcome<FlowExecution> Failure(Problem problem) => Outcome<FlowExecution>.Failure(problem);
}
