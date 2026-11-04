using System.Text.Json;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Features.Flows.Engine;

// What a flow task carries in `local_item.data` (PowerLoom Flow phase 2): the execution and node it belongs to, the flow
// and version it was cut from, and the key that makes creating it idempotent (the unique index on (pbi_id, data->>'key'),
// as a schedule's tasks use it). A task an agent creates inside an execution inherits flowExecutionId and flowNodeId
// from its parent (packages/agents commitCreatedTasks), but not the key: only the engine's own task of a node has one.
public static class FlowTaskData
{
    public const string ExecutionId = "flowExecutionId";
    public const string NodeId = "flowNodeId";
    public const string FlowId = "flowId";
    public const string FlowVersion = "flowVersion";
    public const string Key = "key";
    public const string CreatedBy = "flow";

    private const int TitleMax = 120;
    private const string CustomPrefix = "XT";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Built-in kinds without a pipeline stage keep the prefix the Tasks page gives them; a kind of an agent's own is XT.
    private static readonly Dictionary<string, string> Prefixes = new() { [ItemKinds.Docs] = "WT", [ItemKinds.VaultReview] = "VR" };

    public static string KeyOf(string executionId, string nodeId) => $"{executionId}:{nodeId}";

    public static string? ExecutionIdOf(string? data) => ItemData.StringOf(data, ExecutionId);

    public static string? NodeIdOf(string? data) => ItemData.StringOf(data, NodeId);

    public static string PrefixOf(string kind) => AgentStages.PbiPrefixOf(kind) ?? (Prefixes.TryGetValue(kind, out var prefix) ? prefix : CustomPrefix);

    public static string Serialize(FlowExecution execution, FlowNodeInput node, string goal, IReadOnlyList<string> dependsOn)
    {
        var data = new Dictionary<string, object?>
        {
            [ExecutionId] = execution.Id,
            [NodeId] = node.Id,
            [FlowId] = execution.FlowId,
            [FlowVersion] = execution.FlowVersion,
            [Key] = KeyOf(execution.Id, node.Id),
            ["goal"] = goal,
            ["depth"] = 0,
            ["dependsOn"] = dependsOn,
            ["createdBy"] = CreatedBy,
        };

        return JsonSerializer.Serialize(data, Json);
    }

    // The node's title with its placeholders filled: {kind}, {agent}, {flow}, {pbi} (PBI-<id>, or nothing) and {target}
    // (the PBI or the task the flow runs for).
    public static string TitleOf(FlowNodeInput node, string flowName, FlowExecution execution, int? pbiId)
    {
        var title = (node.Title ?? node.Kind ?? node.Id)
            .Replace("{kind}", node.Kind ?? "", StringComparison.OrdinalIgnoreCase)
            .Replace("{agent}", node.Agent ?? "", StringComparison.OrdinalIgnoreCase)
            .Replace("{flow}", flowName, StringComparison.OrdinalIgnoreCase)
            .Replace("{pbi}", pbiId is null ? "" : $"PBI-{pbiId}", StringComparison.OrdinalIgnoreCase)
            .Replace("{target}", TargetOf(execution, pbiId), StringComparison.OrdinalIgnoreCase)
            .Trim();

        return title.Length <= TitleMax ? title : title[..TitleMax];
    }

    // What the flow runs for, as the tasks name it: the target task, else the PBI.
    public static string TargetOf(FlowExecution execution, int? pbiId) => execution.ItemId ?? (pbiId is null ? execution.Id : $"PBI-{pbiId}");
}
