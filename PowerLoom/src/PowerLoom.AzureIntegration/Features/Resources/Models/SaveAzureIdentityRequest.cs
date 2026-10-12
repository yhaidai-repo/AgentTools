namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// An empty secret keeps the saved one (as the ADO token).
public sealed record SaveAzureIdentityRequest(string TenantId, string ClientId, string? ClientSecret);
