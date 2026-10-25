namespace PowerLoom.GoogleDriveIntegration.Features.Connection.Models;

// What the page may see of the saved settings: never the secret or the token.
public sealed record GoogleDriveSummary(bool Enabled, string ClientId, bool HasClientSecret, string Account, IReadOnlyList<GoogleDriveFolderSummary> Folders);
