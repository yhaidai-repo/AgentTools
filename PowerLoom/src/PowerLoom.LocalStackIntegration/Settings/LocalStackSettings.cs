namespace PowerLoom.LocalStackIntegration.Settings;

// A vault's Local stack (user decision 2026-10-13): agents with the integration switched on start chains of the
// vault's services on the Windows host through the DevSecrets stack bridge while the vault's switch is on.
public sealed class LocalStackSettings
{
    // The bridge as Docker containers reach it; the same default as the TypeScript side (DEFAULT_LOCAL_STACK_URL).
    public const string DefaultUrl = "http://host.docker.internal:47811";

    public bool Enabled { get; set; }

    public string Url { get; set; } = DefaultUrl;

    // The dev-secrets value stack-bridge-token; written by the page, never read back by it.
    public string Token { get; set; } = "";
}
