namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// The identity without its secret: the browser never gets it back.
public sealed record AzureIdentitySummary(string TenantId, string ClientId);
