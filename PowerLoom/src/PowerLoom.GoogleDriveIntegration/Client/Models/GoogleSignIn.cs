namespace PowerLoom.GoogleDriveIntegration.Client.Models;

// What a finished sign-in leaves: the refresh token and the account's email.
public sealed record GoogleSignIn(string RefreshToken, string Account);
