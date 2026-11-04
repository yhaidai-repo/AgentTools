using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Flows.Engine;

// The tasks of one execution: every item carrying its id (the engine's node tasks and what agents created inside it),
// and the task that stands for each node. A node's task is the engine's own (data.key = "<execution>:<node>"); a node
// fed only by optional edges has none of its own, so the task an upstream agent created for it stands in: the first
// task of the node's kind whose parent is a task of one of the node's optional predecessors (assumption).
public sealed class FlowExecutionTasks
{
    private FlowExecutionTasks(List<LocalItem> all, Dictionary<string, LocalItem> byNode, HashSet<string> engineTaskIds)
    {
        All = all;
        ByNode = byNode;
        EngineTaskIds = engineTaskIds;
    }

    public IReadOnlyList<LocalItem> All { get; }

    public IReadOnlyDictionary<string, LocalItem> ByNode { get; }

    /// <summary>The ids of the tasks the engine created itself (one per node).</summary>
    public IReadOnlySet<string> EngineTaskIds { get; }

    public LocalItem? Of(string nodeId) => ByNode.GetValueOrDefault(nodeId);

    public bool IsEngineTask(LocalItem task) => EngineTaskIds.Contains(task.Id);

    public static async Task<FlowExecutionTasks> LoadAsync(PowerLoomDbContext db, FlowExecution execution, FlowGraph graph, CancellationToken cancellation)
    {
        var all = await LoadAllAsync(db, execution.Id, cancellation);
        var byNode = new Dictionary<string, LocalItem>();
        var engineTaskIds = new HashSet<string>();

        foreach (var node in graph.AgentNodes)
        {
            var own = all.FirstOrDefault(task => KeyOf(task) == FlowTaskData.KeyOf(execution.Id, node.Id));

            if (own is null)
                continue;

            byNode[node.Id] = own;
            engineTaskIds.Add(own.Id);
        }

        foreach (var node in graph.AgentNodes.Where(node => !byNode.ContainsKey(node.Id) && graph.IsOptionalOnly(node.Id)))
        {
            var parents = graph.OptionalPredecessors(node.Id).Select(pred => byNode.GetValueOrDefault(pred.Id)?.Id).OfType<string>().ToHashSet();
            var attributed = all.Where(task => task.Kind == node.Kind && task.ParentId is not null && parents.Contains(task.ParentId) && !engineTaskIds.Contains(task.Id)).OrderBy(task => task.CreatedAt).ThenBy(task => task.Id).FirstOrDefault();

            if (attributed is not null)
                byNode[node.Id] = attributed;
        }

        return new FlowExecutionTasks(all, byNode, engineTaskIds);
    }

    // Tracked: the caller may close them (a cancel). A deleted item is gone for the flow too.
    public static Task<List<LocalItem>> LoadAllAsync(PowerLoomDbContext db, string executionId, CancellationToken cancellation)
    {
        return db.LocalItems.FromSql($"select * from local_item where data->>'flowExecutionId' = {executionId}").Where(task => task.Status != ItemStatus.Deleted).OrderBy(task => task.CreatedAt).ThenBy(task => task.Id).ToListAsync(cancellation);
    }

    public static async Task<Dictionary<string, int>> RunCountsAsync(PowerLoomDbContext db, IEnumerable<string> taskIds, CancellationToken cancellation)
    {
        var ids = taskIds.ToArray();

        if (ids.Length == 0)
            return [];

        var counts = await db.AgentRuns.AsNoTracking().Where(run => run.ItemId != null && ids.Contains(run.ItemId)).GroupBy(run => run.ItemId!).Select(group => new { Id = group.Key, Count = group.Count() }).ToListAsync(cancellation);

        return counts.ToDictionary(row => row.Id, row => row.Count);
    }

    public static bool IsClosed(ItemStatus status) => status is ItemStatus.Done or ItemStatus.Cancelled or ItemStatus.Answered or ItemStatus.Dismissed or ItemStatus.Deleted;

    private static string? KeyOf(LocalItem task) => ItemData.StringOf(task.Data, FlowTaskData.Key);
}
