namespace PowerLoom.LocalStackIntegration.Features.DevHub.Models;

// What the page may see of the saved settings: never the token itself.
public sealed record LocalStackSummary(bool Enabled, string Url, bool HasToken);
