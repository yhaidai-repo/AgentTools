namespace PowerLoom.Features.Flows.Models;

// Run a flow for one target of its vault: a PBI (`pbiId`) or a task (`itemId`).
public sealed record RunFlowInput(string Vault, FlowTargetInput Target);

public sealed record FlowTargetInput(string Kind, int? PbiId, string? ItemId);
