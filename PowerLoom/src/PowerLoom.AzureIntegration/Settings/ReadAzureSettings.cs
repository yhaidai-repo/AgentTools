namespace PowerLoom.AzureIntegration.Settings;

// A vault's Read Azure (user decisions 2026-10-12/14): one switch per kind (Azure access, Cosmos DB, Mongo); agents
// with a kind's integration switched on get its tools, read with the vault's own sign-in.
public sealed class ReadAzureSettings
{
    // Kind → switched on; a kind not in the map is off.
    public Dictionary<string, bool> EnabledKinds { get; set; } = [];

    public List<AzureResourceSettings> Resources { get; set; } = [];

    // The subscription (id or name) the Azure MCP server uses when a tool call names none; empty = the agent names one.
    public string Subscription { get; set; } = "";

    public bool IsEnabled(string kind) => EnabledKinds.TryGetValue(kind, out var enabled) && enabled;

    public AzureResourceSettings? Find(string name) => Resources.Find(resource => resource.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
}
