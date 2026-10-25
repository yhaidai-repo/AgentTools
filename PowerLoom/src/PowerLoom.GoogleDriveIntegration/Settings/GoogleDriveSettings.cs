namespace PowerLoom.GoogleDriveIntegration.Settings;

// A vault's Google Drive (user decision 2026-10-25): the user's own Google OAuth client (a Desktop app), the account
// signed in through it (read-only Drive scope) and the folders agents may read; nothing else of the Drive is reachable.
public sealed class GoogleDriveSettings
{
    public bool Enabled { get; set; }

    public string ClientId { get; set; } = "";

    // A Desktop client's secret (Google calls it one, though it isn't kept secret in installed apps); never shown again.
    public string ClientSecret { get; set; } = "";

    // From the sign-in; the agent-runner trades it for short-lived access tokens. Never shown.
    public string RefreshToken { get; set; } = "";

    // The signed-in account's email, as the page shows it.
    public string Account { get; set; } = "";

    public List<GoogleDriveFolder> Folders { get; set; } = [];

    public bool HasClient => ClientId.Length > 0 && ClientSecret.Length > 0;

    public bool IsSignedIn => HasClient && RefreshToken.Length > 0;
}
