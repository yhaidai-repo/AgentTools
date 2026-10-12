namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// What the form holds; an empty secret means the saved one. Nothing is saved.
public sealed record TestAzureIdentityRequest(string TenantId, string ClientId, string? ClientSecret);
