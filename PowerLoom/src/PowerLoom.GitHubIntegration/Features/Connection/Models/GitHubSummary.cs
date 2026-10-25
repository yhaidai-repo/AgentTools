namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// What the page may see of the saved settings: never the token itself.
public sealed record GitHubSummary(bool Enabled, string Owner, string Login, bool HasToken);
