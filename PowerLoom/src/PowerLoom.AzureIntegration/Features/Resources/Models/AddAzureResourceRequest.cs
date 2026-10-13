namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// Target for App Insights (resource id) and Cosmos (endpoint); Secret for Cosmos (read-only key), Service Bus and Mongo
// (connection strings).
public sealed record AddAzureResourceRequest(string Name, string Kind, string? Target, string? Secret);
