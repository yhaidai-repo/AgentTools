namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// Target is the Cosmos DB account name (Cosmos and Mongo kinds); Secret is a connection string, which carries the
// host itself: Service Bus (Listen only), or a Mongo server outside Cosmos (then Target stays empty).
public sealed record AddAzureResourceRequest(string Name, string Kind, string? Target, string? Secret);
