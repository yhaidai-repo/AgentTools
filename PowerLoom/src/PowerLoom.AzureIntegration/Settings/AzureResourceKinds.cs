namespace PowerLoom.AzureIntegration.Settings;

// The resource kinds Read Azure knows, as the TypeScript side (the agent-runner's tools) spells them.
public static class AzureResourceKinds
{
    public const string AppInsights = "appInsights";
    public const string Cosmos = "cosmos";
    public const string ServiceBus = "serviceBus";
    public const string Mongo = "mongo";

    public static readonly IReadOnlyList<string> All = [AppInsights, Cosmos, ServiceBus, Mongo];

    public static bool IsKnown(string kind) => All.Contains(kind);

    // App Insights is read with the user's own sign-in (user decision 2026-10-13); the other kinds carry a key.
    public static bool UsesUserLogin(string kind) => kind == AppInsights;
}
