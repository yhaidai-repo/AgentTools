namespace PowerLoom.GitHubIntegration.Settings;

// How the vault's last GitHub pull request check went, for Settings → Sync: when, what it found, or why it failed.
public sealed class GitHubCheckStatus
{
    public DateTime? CheckedAt { get; set; }

    public string Summary { get; set; } = "";

    public string? Error { get; set; }
}
