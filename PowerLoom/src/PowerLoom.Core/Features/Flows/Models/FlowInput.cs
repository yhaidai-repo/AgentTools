namespace PowerLoom.Features.Flows.Models;

// A flow as the Flow app saves it; `Id` null = a new one. A changed flow keeps its vault.
public sealed record FlowInput(string? Id, string Vault, string Name, FlowDefinitionInput Definition);
