namespace PowerLoom.AzureIntegration.Settings;

// A vault's Read Azure (user decisions 2026-10-12/13): one feature per kind (App Insights, Cosmos DB, Service Bus,
// Mongo), each with its own switch; agents with a kind's integration switched on read its enabled resources. Any
// resource the user adds; no environment allow-list.
public sealed class ReadAzureSettings
{
    // Kind → switched on; a kind not in the map is off.
    public Dictionary<string, bool> EnabledKinds { get; set; } = [];

    public List<AzureResourceSettings> Resources { get; set; } = [];

    public bool IsEnabled(string kind) => EnabledKinds.TryGetValue(kind, out var enabled) && enabled;

    public AzureResourceSettings? Find(string name) => Resources.Find(resource => resource.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
}
