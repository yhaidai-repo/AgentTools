namespace PowerLoom.Features.Flows.Models;

// A flow's canvas (PowerLoom Flow phase 1): the contract of packages/core/src/models/FlowDefinition.ts, validated here
// the same way (FlowDefinitionRules). One node is the trigger (id and type "trigger"); every other node is an agent with
// the task kind it handles. An edge is "required" (the target waits for the source) or "optional" (the agent may create it).
public sealed record FlowDefinitionInput(List<FlowNodeInput> Nodes, List<FlowEdgeInput> Edges);

public sealed record FlowNodeInput(string Id, string Type, string? Agent, string? Kind, string? Title, int? Runs, FlowPosition Position);

public sealed record FlowPosition(double X, double Y);

public sealed record FlowEdgeInput(string Id, string From, string To, string Kind);
