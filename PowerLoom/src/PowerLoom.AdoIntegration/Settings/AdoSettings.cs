namespace PowerLoom.AdoIntegration.Settings;

// A vault's Azure DevOps integration (user decision 2026-10-06: per vault, with its own token and switch). PBI sync,
// mail sync and pull request sync exist only while it is enabled and configured.
public sealed class AdoSettings
{
    public bool Enabled { get; set; }

    public string OrgUrl { get; set; } = "";

    public string Project { get; set; } = "";

    public string Team { get; set; } = "";

    public string User { get; set; } = "";

    // Personal access token (Work Items Read, Code Read); stored in the database, never shown again.
    public string Pat { get; set; } = "";

    // Sync pulls only the PBIs assigned to `User`, so it is required; the token too.
    public bool IsConfigured => new[] { OrgUrl, Project, Team, User, Pat }.All(value => !string.IsNullOrWhiteSpace(value));

    public bool IsActive => Enabled && IsConfigured;
}
