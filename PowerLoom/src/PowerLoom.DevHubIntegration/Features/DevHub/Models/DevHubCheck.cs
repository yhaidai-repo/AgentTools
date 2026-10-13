namespace PowerLoom.DevHubIntegration.Features.DevHub.Models;

// The test's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record DevHubCheck(bool Ok, string Message);
