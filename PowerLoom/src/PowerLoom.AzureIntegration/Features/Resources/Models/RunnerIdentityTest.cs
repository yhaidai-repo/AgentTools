namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// The agent-runner's `POST /azure/test` body.
public sealed record RunnerIdentityTest(string TenantId, string ClientId, string ClientSecret);
