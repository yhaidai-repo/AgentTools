namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// Target is the Cosmos DB account name (Cosmos and Mongo kinds).
public sealed record AddAzureResourceRequest(string Name, string Kind, string? Target);
