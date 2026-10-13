namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// The agent-runner's `POST /azure/login/start` body.
public sealed record RunnerLoginStart(string Vault);
