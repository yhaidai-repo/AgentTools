namespace PowerLoom.DevHubIntegration.Features.DevHub.Models;

// The typed URL and token, or the saved ones where a field is empty. Nothing is saved.
public sealed record TestDevHubRequest(string? Url, string? Token);
