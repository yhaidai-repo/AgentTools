namespace PowerLoom.AzureIntegration.Settings;

// A vault's Read Azure (user decision 2026-10-12): agents with a kind's integration switched on read these resources
// while the vault's switch is on. Any resource the user adds; no environment allow-list.
public sealed class ReadAzureSettings
{
    public bool Enabled { get; set; }

    // Null until the service principal was saved once. Mongo resources don't use it (a connection string instead).
    public AzureIdentitySettings? Identity { get; set; }

    public List<AzureResourceSettings> Resources { get; set; } = [];

    public AzureResourceSettings? Find(string name) => Resources.Find(resource => resource.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
}
