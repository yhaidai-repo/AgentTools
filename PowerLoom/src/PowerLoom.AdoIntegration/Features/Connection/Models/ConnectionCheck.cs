namespace PowerLoom.AdoIntegration.Features.Connection.Models;

// The check's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record ConnectionCheck(bool Ok, string Message);
