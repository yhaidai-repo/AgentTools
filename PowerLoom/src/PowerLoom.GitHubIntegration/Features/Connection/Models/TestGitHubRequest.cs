namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// The typed token and owner; empty fields test the saved ones.
public sealed record TestGitHubRequest(string? Token, string? Owner);
