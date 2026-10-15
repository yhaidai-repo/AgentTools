namespace PowerLoom.AzureIntegration.Settings;

public sealed class AzureResourceSettings
{
    // What agents pick the resource by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // One of AzureResourceKinds (Cosmos, Mongo or Service Bus: Azure access has no resources).
    public string Kind { get; set; } = "";

    // The Cosmos DB account name, or the host of a Service Bus namespace or a Mongo server outside Cosmos.
    public string Target { get; set; } = "";

    // The Service Bus Listen-only connection string, or a Mongo server's connection string (user decisions 2026-10-14/15).
    // Stored in the database, never shown again; empty for Cosmos accounts, whose keys come with the sign-in at call time.
    public string Secret { get; set; } = "";

    // What the Settings page shows for the target.
    public string Display { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
