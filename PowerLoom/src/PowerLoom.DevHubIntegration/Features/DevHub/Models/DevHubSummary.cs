namespace PowerLoom.DevHubIntegration.Features.DevHub.Models;

// What the page may see of the saved settings: never the token itself.
public sealed record DevHubSummary(bool Enabled, string Url, bool HasToken);
