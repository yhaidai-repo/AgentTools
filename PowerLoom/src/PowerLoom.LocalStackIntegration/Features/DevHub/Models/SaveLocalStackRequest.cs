namespace PowerLoom.LocalStackIntegration.Features.DevHub.Models;

// The page's form. An empty URL means the default; an empty token keeps the saved one.
public sealed record SaveLocalStackRequest(bool Enabled, string? Url, string? Token);
