using PowerLoom.GoogleDriveIntegration.Client.Models;

namespace PowerLoom.GoogleDriveIntegration.Client;

// Google's sign-in and Drive as Settings needs them; the agents' reads are the agent-runner's (TypeScript).
public interface IGoogleApi
{
    /// <summary>Trades the sign-in's code (PKCE) for a refresh token.</summary>
    Task<GoogleSignIn> SignInAsync(GoogleClient client, string code, string codeVerifier, string redirectUri, CancellationToken cancellation);

    /// <summary>A file or folder (also a shared drive's root) the signed-in account can see; null when there is none.</summary>
    Task<DriveItem?> GetItemAsync(GoogleClient client, string refreshToken, string id, CancellationToken cancellation);
}
