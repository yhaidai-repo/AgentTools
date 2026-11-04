using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;

namespace PowerLoom.Features.Flows.Engine;

// The flow engine (PowerLoom Flow phase 2). One advance of a running execution: every agent node without a task whose
// required predecessors are all Done gets its task, pinned to the node's agent, depending on the predecessors' tasks and
// handed their last results through a `handoff` row each (so its agent reads the upstream output as <handoff>, as
// today); a node fed by the trigger alone starts with the execution. Then the execution settles: failed when a node's
// task was cancelled (or dismissed, deleted), done when every node's task is Done and nothing created inside the
// execution is still open. Advancing is idempotent: one advance at a time per execution (an advisory lock), and a node's
// task is found by its key before it is created (the unique index (pbi_id, data->>'key') is the backstop on a PBI).
// A blocked task doesn't fail the execution: the person Re-runs it as today and the execution goes on (assumption).
public sealed class FlowAdvancer(PowerLoomDbContext db, IMessageBus bus, ILogger<FlowAdvancer> logger)
{
    public const string Actor = "flow";

    private const string Continue = "continue";

    private static readonly ItemStatus[] Failing = [ItemStatus.Cancelled, ItemStatus.Dismissed, ItemStatus.Deleted];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly KebabCaseNameTranslator Labels = new();

    // After a task of an execution changed (a run ended, a person closed it): the hooks must not fail the change they
    // follow, so a failure is logged and the ticker's advance tries again.
    public async Task AdvanceForTaskAsync(LocalItem task, CancellationToken cancellation)
    {
        var executionId = FlowTaskData.ExecutionIdOf(task.Data);

        if (executionId is null)
            return;

        try
        {
            await AdvanceAsync(executionId, cancellation);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogError(error, "flow {Execution}: advancing after {Task} failed; the next tick tries again", executionId, task.Id);
        }
    }

    public async Task<FlowAdvanceResult> AdvanceAsync(string executionId, CancellationToken cancellation)
    {
        List<LocalItem> created;
        FlowExecution? execution;
        int? pbiId;

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellation))
        {
            await db.Database.ExecuteSqlAsync($"select pg_advisory_xact_lock(hashtext({executionId}))", cancellation);
            execution = await db.FlowExecutions.SingleOrDefaultAsync(row => row.Id == executionId, cancellation);

            if (execution is null || execution.Status != FlowStatuses.Running)
            {
                await transaction.CommitAsync(cancellation);

                return new FlowAdvanceResult(executionId, execution?.Status, []);
            }

            var graph = FlowGraph.Of(FlowJson.Parse(execution.Definition));
            var flowName = await db.Flows.AsNoTracking().Where(flow => flow.Id == execution.FlowId).Select(flow => flow.Name).SingleOrDefaultAsync(cancellation) ?? execution.FlowId;
            var tasks = await FlowExecutionTasks.LoadAsync(db, execution, graph, cancellation);

            pbiId = await TargetPbiIdAsync(db, execution, cancellation);
            created = await CreateReadyTasksAsync(execution, pbiId, graph, flowName, tasks, cancellation);
            Settle(execution, graph, tasks, created);
            await db.SaveChangesAsync(cancellation);
            await transaction.CommitAsync(cancellation);
        }

        foreach (var agent in created.Select(task => AgentStages.AgentIdOf(task.Assignee)).OfType<string>().Distinct())
            await bus.PublishAsync(new DispatchAgent(agent));

        if (created.Count > 0 || execution.Status != FlowStatuses.Running)
            await PbiChanges.PublishAsync(db, bus, pbiId, Actor, cancellation);

        logger.LogInformation("flow {Execution}: {Status}, created {Created}", executionId, execution.Status, created.Count == 0 ? "nothing" : string.Join(", ", created.Select(task => task.Id)));

        return new FlowAdvanceResult(executionId, execution.Status, created.Select(task => task.Id).ToList());
    }

    // The PBI the execution's tasks belong to: the target PBI, or the target task's (a task without one gives none).
    public static async Task<int?> TargetPbiIdAsync(PowerLoomDbContext db, FlowExecution execution, CancellationToken cancellation)
    {
        if (execution.PbiId is not null || execution.ItemId is null)
            return execution.PbiId;

        return await db.LocalItems.AsNoTracking().Where(item => item.Id == execution.ItemId).Select(item => item.PbiId).SingleOrDefaultAsync(cancellation);
    }

    private async Task<List<LocalItem>> CreateReadyTasksAsync(FlowExecution execution, int? pbiId, FlowGraph graph, string flowName, FlowExecutionTasks tasks, CancellationToken cancellation)
    {
        var created = new List<LocalItem>();

        foreach (var node in graph.AgentNodes.Where(node => tasks.Of(node.Id) is null && !graph.IsOptionalOnly(node.Id)))
        {
            var predecessors = graph.RequiredPredecessors(node.Id).Select(pred => tasks.Of(pred.Id)).ToList();

            if (predecessors.Any(pred => pred is null || pred.Status != ItemStatus.Done))
                continue;

            created.Add(await CreateTaskAsync(execution, pbiId, node, flowName, predecessors.Select(pred => pred!).ToList(), cancellation));
        }

        return created;
    }

    private async Task<LocalItem> CreateTaskAsync(FlowExecution execution, int? pbiId, FlowNodeInput node, string flowName, IReadOnlyList<LocalItem> predecessors, CancellationToken cancellation)
    {
        var title = FlowTaskData.TitleOf(node, flowName, execution, pbiId);
        var prefix = FlowTaskData.PrefixOf(node.Kind!);
        var task = new LocalItem
        {
            Id = pbiId is null ? await ItemIds.NextGlobalAsync(db, prefix, cancellation) : await ItemIds.NextAsync(db, prefix, pbiId.Value, cancellation),
            Kind = node.Kind!,
            PbiId = pbiId,
            ParentId = execution.TargetKind == FlowTargetKinds.Task ? execution.ItemId : null,
            Vault = execution.Vault,
            Title = title,
            Status = ItemStatus.Open,
            Assignee = AgentStages.AssigneeOf(node.Agent!),
            Body = BodyOf(execution, pbiId, flowName, title, predecessors),
            Data = FlowTaskData.Serialize(execution, node, title, predecessors.Select(pred => pred.Id).ToList()),
            HeldBy = "[]",
        };

        db.LocalItems.Add(task);
        await db.SaveChangesAsync(cancellation);

        foreach (var predecessor in predecessors)
            await InsertHandoffAsync(flowName, task, title, predecessor, cancellation);

        return task;
    }

    private static string BodyOf(FlowExecution execution, int? pbiId, string flowName, string title, IReadOnlyList<LocalItem> predecessors)
    {
        var line = $"Step \"{title}\" of flow \"{flowName}\" ({execution.Id}) for {FlowTaskData.TargetOf(execution, pbiId)}.";

        return predecessors.Count == 0 ? line : $"{line} Continues {string.Join(", ", predecessors.Select(pred => pred.Id))}: the result is handed off below.";
    }

    // The predecessor's last run is the sender; its last successful run's result is what the next agent reads.
    private async Task InsertHandoffAsync(string flowName, LocalItem task, string title, LocalItem predecessor, CancellationToken cancellation)
    {
        var runs = await db.AgentRuns.AsNoTracking().Where(run => run.ItemId == predecessor.Id).OrderByDescending(run => run.Id).Select(run => new { run.Id, run.Outcome }).ToListAsync(cancellation);
        var lastRunId = runs.FirstOrDefault()?.Id;
        var lastSuccessId = runs.FirstOrDefault(run => run.Outcome == RunOutcome.Success)?.Id;
        var agent = AgentStages.AgentIdOf(predecessor.Assignee) ?? predecessor.Assignee;
        var body = $"{flowName} → {title}: continue with the result of {predecessor.Title}";
        var refs = JsonSerializer.Serialize(new { results = lastSuccessId is null ? [] : new[] { $"RUN-{lastSuccessId}" }, items = new[] { predecessor.Id }, notes = Array.Empty<string>() }, Json);

        await db.Database.ExecuteSqlAsync($"insert into handoff (from_task_id, from_agent, from_run_id, to_kind, to_item_id, intent, gate, body, refs, status) values ({predecessor.Id}, {agent}, {lastRunId}, 'agent', {task.Id}, {Continue}, 'none', {body}, {refs}::jsonb, 'open')", cancellation);
    }

    // Failed on the first node task a person cancelled (or deleted); done once every node that can have a task has one
    // in Done and nothing created inside the execution is open. A node the engine never creates (optional-only) counts
    // as skipped unless an agent created its task; what agents created inside the execution must close, in any way,
    // before the execution is done (assumption).
    private static void Settle(FlowExecution execution, FlowGraph graph, FlowExecutionTasks tasks, List<LocalItem> created)
    {
        var failed = graph.AgentNodes.Select(node => tasks.Of(node.Id)).FirstOrDefault(task => task is not null && tasks.IsEngineTask(task) && Failing.Contains(task.Status));

        if (failed is not null)
        {
            Finish(execution, FlowStatuses.Failed, $"Step \"{failed.Title}\" ({failed.Id}) was {Labels.TranslateMemberName(failed.Status.ToString())}.");

            return;
        }

        if (created.Count > 0)
            return;

        var nodesDone = graph.AgentNodes.All(node => graph.IsOptionalOnly(node.Id) || tasks.Of(node.Id)?.Status == ItemStatus.Done);
        var nothingOpen = tasks.All.All(task => FlowExecutionTasks.IsClosed(task.Status));

        if (nodesDone && nothingOpen)
            Finish(execution, FlowStatuses.Done, null);
    }

    private static void Finish(FlowExecution execution, string status, string? error)
    {
        execution.Status = status;
        execution.Error = error;
        execution.FinishedAt = DateTime.UtcNow;
    }
}
