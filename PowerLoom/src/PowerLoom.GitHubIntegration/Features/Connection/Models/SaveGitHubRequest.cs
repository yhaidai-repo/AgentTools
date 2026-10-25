namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// The page's form. An empty token keeps the saved one; an empty owner lists every repo the token can read.
public sealed record SaveGitHubRequest(bool Enabled, string? Token, string? Owner);
