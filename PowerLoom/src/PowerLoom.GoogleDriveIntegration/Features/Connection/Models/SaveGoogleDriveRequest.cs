namespace PowerLoom.GoogleDriveIntegration.Features.Connection.Models;

// The page's form: the switch and the OAuth client; an empty secret keeps the saved one.
public sealed record SaveGoogleDriveRequest(bool Enabled, string? ClientId, string? ClientSecret);
