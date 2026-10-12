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

    // Mongo connects with its own connection string (Cosmos DB for MongoDB RU, user decision 2026-10-12), not the
    // vault's service principal.
    public static bool UsesIdentity(string kind) => kind != Mongo;
}
