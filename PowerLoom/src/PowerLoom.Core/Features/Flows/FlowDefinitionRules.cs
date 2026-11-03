using PowerLoom.Contracts;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.AgentConfig.Models;

namespace PowerLoom.Features.Flows;

// What a definition must satisfy before it is saved; the same rules as the TypeScript schema (flowDefinitionSchema),
// plus the one only the backend can check: an agent node's kind is one its agent handles.
public static class FlowDefinitionRules
{
    public static Problem? Check(FlowDefinitionInput definition)
    {
        return NodesProblem(definition.Nodes) ?? EdgesProblem(definition) ?? RequiredCycleProblem(definition);
    }

    public static async Task<Problem?> CheckAgentsAsync(FlowDefinitionInput definition, AgentConfigReader agents, CancellationToken cancellation)
    {
        var known = new Dictionary<string, AgentSummary?>();

        foreach (var node in definition.Nodes.Where(node => node.Type == FlowNodeTypes.Agent))
        {
            if (!known.TryGetValue(node.Agent!, out var agent))
                known[node.Agent!] = agent = await agents.ReadAsync(node.Agent!, cancellation);

            if (agent is null)
                return Problem.Invalid($"Node \"{node.Id}\": agent \"{node.Agent}\" is not configured.");

            if (!agent.Handles.Contains(node.Kind!))
                return Problem.Invalid($"Node \"{node.Id}\": agent \"{node.Agent}\" doesn't handle \"{node.Kind}\" (it handles: {Listed(agent.Handles)}).");
        }

        return null;
    }

    private static Problem? NodesProblem(List<FlowNodeInput> nodes)
    {
        var ids = new HashSet<string>();

        foreach (var node in nodes)
        {
            if (string.IsNullOrWhiteSpace(node.Id))
                return Problem.Invalid("Every node needs an id.");

            if (!ids.Add(node.Id))
                return Problem.Invalid($"Node id \"{node.Id}\" is used twice.");

            var problem = node.Type switch
            {
                FlowNodeTypes.Trigger => node.Id == FlowNodeTypes.TriggerId ? null : Problem.Invalid($"The trigger node's id is \"{FlowNodeTypes.TriggerId}\", not \"{node.Id}\"."),
                FlowNodeTypes.Agent => AgentNodeProblem(node),
                _ => Problem.Invalid($"Node \"{node.Id}\": type \"{node.Type}\" isn't \"{FlowNodeTypes.Trigger}\" or \"{FlowNodeTypes.Agent}\"."),
            };

            if (problem is not null)
                return problem;
        }

        return nodes.Count(node => node.Type == FlowNodeTypes.Trigger) == 1 ? null : Problem.Invalid($"A flow has exactly one trigger node (id \"{FlowNodeTypes.TriggerId}\").");
    }

    private static Problem? AgentNodeProblem(FlowNodeInput node)
    {
        if (node.Id == FlowNodeTypes.TriggerId)
            return Problem.Invalid($"Node id \"{FlowNodeTypes.TriggerId}\" belongs to the trigger node.");

        if (string.IsNullOrWhiteSpace(node.Agent))
            return Problem.Invalid($"Node \"{node.Id}\" needs an agent.");

        if (string.IsNullOrWhiteSpace(node.Kind))
            return Problem.Invalid($"Node \"{node.Id}\" needs a task kind.");

        if (string.IsNullOrWhiteSpace(node.Title))
            return Problem.Invalid($"Node \"{node.Id}\" needs a title.");

        return node.Runs is < 1 ? Problem.Invalid($"Node \"{node.Id}\": runs is at least 1.") : null;
    }

    private static Problem? EdgesProblem(FlowDefinitionInput definition)
    {
        var nodes = definition.Nodes.Select(node => node.Id).ToHashSet();
        var ids = new HashSet<string>();

        foreach (var edge in definition.Edges)
        {
            if (string.IsNullOrWhiteSpace(edge.Id))
                return Problem.Invalid("Every edge needs an id.");

            if (!ids.Add(edge.Id))
                return Problem.Invalid($"Edge id \"{edge.Id}\" is used twice.");

            if (edge.Kind is not (FlowEdgeKinds.Required or FlowEdgeKinds.Optional))
                return Problem.Invalid($"Edge \"{edge.Id}\": kind \"{edge.Kind}\" isn't \"{FlowEdgeKinds.Required}\" or \"{FlowEdgeKinds.Optional}\".");

            if (!nodes.Contains(edge.From) || !nodes.Contains(edge.To))
                return Problem.Invalid($"Edge \"{edge.Id}\" goes from \"{edge.From}\" to \"{edge.To}\", but there is no such node.");

            if (edge.From == edge.To)
                return Problem.Invalid($"Edge \"{edge.Id}\" connects \"{edge.From}\" to itself.");

            if (edge.To == FlowNodeTypes.TriggerId)
                return Problem.Invalid($"Edge \"{edge.Id}\": nothing leads into the trigger.");
        }

        return null;
    }

    // A required cycle would wait for itself forever; optional edges only say what an agent may create.
    private static Problem? RequiredCycleProblem(FlowDefinitionInput definition)
    {
        var next = definition.Edges.Where(edge => edge.Kind == FlowEdgeKinds.Required).ToLookup(edge => edge.From, edge => edge.To);
        var finished = new HashSet<string>();
        var path = new HashSet<string>();

        foreach (var node in definition.Nodes)
        {
            var cycle = CycleFrom(node.Id, next, finished, path);

            if (cycle is not null)
                return Problem.Invalid($"Required edges form a cycle through \"{cycle}\".");
        }

        return null;
    }

    private static string? CycleFrom(string node, ILookup<string, string> next, HashSet<string> finished, HashSet<string> path)
    {
        if (finished.Contains(node))
            return null;

        if (!path.Add(node))
            return node;

        foreach (var target in next[node])
        {
            var cycle = CycleFrom(target, next, finished, path);

            if (cycle is not null)
                return cycle;
        }

        path.Remove(node);
        finished.Add(node);

        return null;
    }

    private static string Listed(IReadOnlyList<string> handles) => handles.Count == 0 ? "nothing" : string.Join(", ", handles);
}
