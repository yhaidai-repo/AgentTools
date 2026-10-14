namespace PowerLoom.AzureIntegration.Settings;

// The kinds Read Azure knows, as the TypeScript side (the agent-runner's tools) spells them. Azure access is the
// Azure MCP server's read tools with no resources of its own; Cosmos and Mongo keep an allow-list of accounts read
// with keys the sign-in fetches; Service Bus keeps namespaces with a Listen-only connection string each (user
// decisions 2026-10-14).
public static class AzureResourceKinds
{
    public const string AzureAccess = "azureAccess";
    public const string Cosmos = "cosmos";
    public const string Mongo = "mongo";
    public const string ServiceBus = "serviceBus";

    public static readonly IReadOnlyList<string> All = [AzureAccess, Cosmos, Mongo, ServiceBus];

    public static bool IsKnown(string kind) => All.Contains(kind);

    public static bool HasResources(string kind) => kind is Cosmos or Mongo or ServiceBus;

    // Only Service Bus stores a secret; Cosmos and Mongo keys come with the sign-in at call time.
    public static bool HasSecret(string kind) => kind == ServiceBus;
}
