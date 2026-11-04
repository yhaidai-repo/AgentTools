using PowerLoom.Features.Flows.Models;

namespace PowerLoom.Features.Flows.Engine;

// A snapshot's agent nodes and what feeds each one. A node fed by the trigger, or by nothing, starts with the execution.
// A required edge from an agent node makes the target wait for the source's task; a node fed only by optional edges is
// never created by the engine (its upstream agent may create the task itself: today's canAssign), so it can't block the
// execution either.
public sealed class FlowGraph
{
    private readonly Dictionary<string, FlowNodeInput> _nodes;
    private readonly ILookup<string, string> _required;
    private readonly ILookup<string, string> _optional;
    private readonly HashSet<string> _fromTrigger;

    private FlowGraph(FlowDefinitionInput definition)
    {
        _nodes = definition.Nodes.Where(node => node.Type == FlowNodeTypes.Agent).ToDictionary(node => node.Id);
        _required = definition.Edges.Where(edge => edge.Kind == FlowEdgeKinds.Required && _nodes.ContainsKey(edge.From) && _nodes.ContainsKey(edge.To)).ToLookup(edge => edge.To, edge => edge.From);
        _optional = definition.Edges.Where(edge => edge.Kind == FlowEdgeKinds.Optional && _nodes.ContainsKey(edge.From) && _nodes.ContainsKey(edge.To)).ToLookup(edge => edge.To, edge => edge.From);
        _fromTrigger = definition.Edges.Where(edge => edge.From == FlowNodeTypes.TriggerId).Select(edge => edge.To).ToHashSet();
    }

    public static FlowGraph Of(FlowDefinitionInput definition) => new(definition);

    public IReadOnlyCollection<FlowNodeInput> AgentNodes => _nodes.Values;

    public FlowNodeInput? Node(string id) => _nodes.GetValueOrDefault(id);

    /// <summary>The agent nodes a required edge leads from into this node, in edge order.</summary>
    public IReadOnlyList<FlowNodeInput> RequiredPredecessors(string nodeId) => _required[nodeId].Select(id => _nodes[id]).ToList();

    /// <summary>The agent nodes an optional edge leads from into this node.</summary>
    public IReadOnlyList<FlowNodeInput> OptionalPredecessors(string nodeId) => _optional[nodeId].Select(id => _nodes[id]).ToList();

    /// <summary>Fed by agent nodes through optional edges only, and not by the trigger: the engine never creates its task.</summary>
    public bool IsOptionalOnly(string nodeId) => !_fromTrigger.Contains(nodeId) && !_required[nodeId].Any() && _optional[nodeId].Any();
}
