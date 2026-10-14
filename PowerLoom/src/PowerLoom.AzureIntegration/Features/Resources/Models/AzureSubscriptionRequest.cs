namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// The subscription (id or name) the Azure MCP server uses when a tool call names none; empty clears it.
public sealed record AzureSubscriptionRequest(string? Subscription);
