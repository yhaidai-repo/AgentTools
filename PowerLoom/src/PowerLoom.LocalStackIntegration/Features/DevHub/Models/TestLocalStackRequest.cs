namespace PowerLoom.LocalStackIntegration.Features.DevHub.Models;

// The typed URL and token, or the saved ones where a field is empty. Nothing is saved.
public sealed record TestLocalStackRequest(string? Url, string? Token);
