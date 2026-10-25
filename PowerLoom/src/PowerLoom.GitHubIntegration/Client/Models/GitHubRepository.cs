namespace PowerLoom.GitHubIntegration.Client.Models;

public sealed record GitHubRepository(string Owner, string Name, string CloneUrl, string? DefaultBranch, bool IsArchived);
