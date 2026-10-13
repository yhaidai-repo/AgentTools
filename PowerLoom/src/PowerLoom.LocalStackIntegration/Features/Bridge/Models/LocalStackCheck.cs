namespace PowerLoom.LocalStackIntegration.Features.Bridge.Models;

// The test's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record LocalStackCheck(bool Ok, string Message);
