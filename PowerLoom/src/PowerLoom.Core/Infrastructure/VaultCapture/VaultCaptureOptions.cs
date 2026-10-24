namespace PowerLoom.Infrastructure.VaultCapture;

public sealed class VaultCaptureOptions
{
    public const string Section = "VaultCapture";

    // The folder with vault-capture.ps1 (the user's PowerShell module, mounted into the container).
    public string Home { get; set; } = "";
}
