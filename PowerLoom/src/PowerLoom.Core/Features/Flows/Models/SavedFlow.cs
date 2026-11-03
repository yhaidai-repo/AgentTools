namespace PowerLoom.Features.Flows.Models;

public sealed record SavedFlow(string Id, string Vault, string Name, int Version, FlowDefinitionInput Definition, DateTime CreatedAt, DateTime UpdatedAt);
