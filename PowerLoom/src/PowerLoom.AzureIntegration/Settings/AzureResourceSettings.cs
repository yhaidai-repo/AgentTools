namespace PowerLoom.AzureIntegration.Settings;

public sealed class AzureResourceSettings
{
    // What agents pick the resource by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // One of AzureResourceKinds (Cosmos or Mongo: Azure access has no resources).
    public string Kind { get; set; } = "";

    // The Cosmos DB account name; its keys come with the vault's sign-in at call time, nothing is stored.
    public string Target { get; set; } = "";

    // What the Settings page shows for the target.
    public string Display { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
