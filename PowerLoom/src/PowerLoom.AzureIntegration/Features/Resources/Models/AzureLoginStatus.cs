namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// `pending` while the user hasn't finished at the link; `done` with the username; `failed` with the reason.
public sealed record AzureLoginStatus(string Status, string? Username, string? Error);
