namespace DevSecrets.DevHub.Models;

public sealed class DevHubOptions
{
    public const string Section = "DevHub";

    // Shared with PowerLoom; Start-DevHub.ps1 passes it from the dev-secrets value "dev-hub-token".
    public string Token { get; set; } = "";

    // The DevSecrets folder that holds Start-/Get-/Stop-LocalStack.ps1 and services.json.
    public string ScriptsDir { get; set; } = "";

    // Where the secret values live (values.<name>.json, outside git): DEV_SECRETS_VALUES_DIR or D:/Projects/dev-secrets.
    public string ValuesDir { get; set; } = "";

    public int DefaultTtlMinutes { get; set; } = 60;

    public int MaxTtlMinutes { get; set; } = 240;
    // Where browser cases leave their video and trace: <owner>/<case>/ under it (Start-DevHub.ps1 passes <stack>/browser).
    public string BrowserArtifactsDir { get; set; } = "";

    // A browser case nobody calls for this long is closed, its recording written.
    public int BrowserIdleMinutes { get; set; } = 30;

    // Empty: Playwright's own Chromium (playwright.ps1 install chromium). "msedge" or "chrome": the browser installed on this PC.
    public string BrowserChannel { get; set; } = "";
}
