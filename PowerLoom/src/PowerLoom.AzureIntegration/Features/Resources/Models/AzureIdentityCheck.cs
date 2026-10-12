namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// The check's outcome as the Settings page shows it: a failed check is an answer, not an error.
public sealed record AzureIdentityCheck(bool Ok, string Message);
