namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// The test's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record GitHubCheck(bool Ok, string Message);
