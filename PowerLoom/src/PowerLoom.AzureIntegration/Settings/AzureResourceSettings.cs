namespace PowerLoom.AzureIntegration.Settings;

public sealed class AzureResourceSettings
{
    // What agents pick the resource by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // One of AzureResourceKinds.
    public string Kind { get; set; } = "";

    // What the kind connects to: a resource id (App Insights, Service Bus), an account endpoint (Cosmos) or a connection
    // string (Mongo; stored in the database, never shown again).
    public string Target { get; set; } = "";

    // What the Settings page shows for the target: the target itself, or only the host of a connection string.
    public string Display { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
