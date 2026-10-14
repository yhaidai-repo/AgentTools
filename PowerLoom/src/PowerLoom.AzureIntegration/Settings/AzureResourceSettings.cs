namespace PowerLoom.AzureIntegration.Settings;

public sealed class AzureResourceSettings
{
    // What agents pick the resource by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // One of AzureResourceKinds (Cosmos, Mongo or Service Bus: Azure access has no resources).
    public string Kind { get; set; } = "";

    // The Cosmos DB account name, or the Service Bus namespace host.
    public string Target { get; set; } = "";

    // Service Bus only: the Listen-only connection string (user decision 2026-10-14). Stored in the database, never
    // shown again; empty for Cosmos and Mongo, whose keys come with the sign-in at call time.
    public string Secret { get; set; } = "";

    // What the Settings page shows for the target.
    public string Display { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
