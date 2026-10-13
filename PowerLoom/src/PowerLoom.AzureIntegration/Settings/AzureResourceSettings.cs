namespace PowerLoom.AzureIntegration.Settings;

public sealed class AzureResourceSettings
{
    // What agents pick the resource by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // One of AzureResourceKinds.
    public string Kind { get; set; } = "";

    // The public part: a resource id (App Insights), an account endpoint (Cosmos) or a host (Service Bus, Mongo).
    public string Target { get; set; } = "";

    // The key or connection string (user decision 2026-10-13: keys per resource); empty for App Insights, which the
    // user's own sign-in reads. Stored in the database, never shown again.
    public string Secret { get; set; } = "";

    // What the Settings page shows for the target.
    public string Display { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
