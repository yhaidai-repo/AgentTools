namespace PowerLoom.DevHubIntegration.Settings;

// A vault's DevHub (user decision 2026-10-13): agents with the integration switched on start chains of the
// vault's services on the Windows host through DevHub while the vault's switch is on.
public sealed class DevHubSettings
{
    // DevHub as Docker containers reach it; the same default as the TypeScript side (DEFAULT_DEVHUB_URL).
    public const string DefaultUrl = "http://host.docker.internal:47811";

    public bool Enabled { get; set; }

    public string Url { get; set; } = DefaultUrl;

    // The dev-secrets value dev-hub-token; written by the page, never read back by it.
    public string Token { get; set; } = "";
}
