using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Flows.Engine;

// One step per agent node of the snapshot, in the definition's order, from the execution's tasks: the node's task with
// its status and how many runs it took; "pending" while the execution runs and the task doesn't exist yet, "skipped"
// once the execution finished without one (packages/core's flowStepsOf mirrors this for the Flow app's reads).
public static class FlowSteps
{
    public const string Pending = "pending";
    public const string Skipped = "skipped";

    private static readonly KebabCaseNameTranslator Labels = new();

    public static async Task<List<FlowStepView>> ComputeAsync(PowerLoomDbContext db, FlowExecution execution, CancellationToken cancellation)
    {
        var definition = FlowJson.Parse(execution.Definition);
        var graph = FlowGraph.Of(definition);
        var tasks = await FlowExecutionTasks.LoadAsync(db, execution, graph, cancellation);
        var runs = await FlowExecutionTasks.RunCountsAsync(db, tasks.ByNode.Values.Select(task => task.Id), cancellation);

        return definition.Nodes.Where(node => node.Type == FlowNodeTypes.Agent).Select(node => StepOf(execution, node, tasks.Of(node.Id), runs)).ToList();
    }

    private static FlowStepView StepOf(FlowExecution execution, FlowNodeInput node, LocalItem? task, Dictionary<string, int> runs)
    {
        if (task is null)
            return new FlowStepView(node.Id, null, execution.Status == FlowStatuses.Running ? Pending : Skipped, 0, node.Agent ?? "", node.Kind ?? "");

        return new FlowStepView(node.Id, task.Id, Labels.TranslateMemberName(task.Status.ToString()), runs.GetValueOrDefault(task.Id), AgentStages.AgentIdOf(task.Assignee) ?? node.Agent ?? "", task.Kind);
    }
}
