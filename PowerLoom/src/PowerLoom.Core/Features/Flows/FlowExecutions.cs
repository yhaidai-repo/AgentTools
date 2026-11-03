using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Flows;

// A flow's executions: started here with the definition as it is now (phase 1 records the execution; the engine that
// creates the nodes' tasks is phase 2), cancelled by the user.
public sealed class FlowExecutions(PowerLoomDbContext db)
{
    private const string IdPrefix = "FX";

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

        return Outcome<FlowExecution>.Success(execution);
    }

    public static FlowExecutionView View(FlowExecution row)
    {
        return new FlowExecutionView(row.Id, row.FlowId, row.FlowVersion, row.Vault, row.TargetKind, row.PbiId, row.ItemId, row.Status, row.Error, row.StartedAt, row.FinishedAt, FlowJson.Parse(row.Definition));
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
