namespace DevSecrets.StackBridge.Models;

public sealed class StackBridgeOptions
{
    public const string Section = "StackBridge";

    // Shared with PowerLoom; Start-StackBridge.ps1 passes it from the dev-secrets value "stack-bridge-token".
    public string Token { get; set; } = "";

    // The DevSecrets folder that holds Start-/Get-/Stop-LocalStack.ps1 and services.json.
    public string ScriptsDir { get; set; } = "";

    public int DefaultTtlMinutes { get; set; } = 60;

    public int MaxTtlMinutes { get; set; } = 240;
}
