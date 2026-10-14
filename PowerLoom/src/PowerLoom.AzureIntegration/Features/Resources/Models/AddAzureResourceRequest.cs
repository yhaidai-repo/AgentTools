namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// Target is the Cosmos DB account name (Cosmos and Mongo kinds); Secret is the Listen-only connection string
// (Service Bus kind), which carries the namespace itself.
public sealed record AddAzureResourceRequest(string Name, string Kind, string? Target, string? Secret);
