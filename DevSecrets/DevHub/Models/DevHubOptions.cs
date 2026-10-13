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
}
