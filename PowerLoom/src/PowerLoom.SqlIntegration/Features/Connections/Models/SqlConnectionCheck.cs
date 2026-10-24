namespace PowerLoom.SqlIntegration.Features.Connections.Models;

// The check's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record SqlConnectionCheck(bool Ok, string Message);
