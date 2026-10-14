namespace PowerLoom.AzureIntegration.Settings;

// The kinds Read Azure knows, as the TypeScript side (the agent-runner's tools) spells them. Azure access is the
// Azure MCP server's read tools with no resources of its own; Cosmos and Mongo keep an allow-list of accounts
// (user decision 2026-10-14).
public static class AzureResourceKinds
{
    public const string AzureAccess = "azureAccess";
    public const string Cosmos = "cosmos";
    public const string Mongo = "mongo";

    public static readonly IReadOnlyList<string> All = [AzureAccess, Cosmos, Mongo];

    public static bool IsKnown(string kind) => All.Contains(kind);

    public static bool HasResources(string kind) => kind is Cosmos or Mongo;
}
