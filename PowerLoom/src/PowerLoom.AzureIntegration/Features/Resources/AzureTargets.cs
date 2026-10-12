using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// What each kind's target must look like, checked at save so a typo is an answer here and not a failed agent run.
public static partial class AzureTargets
{
    // Why the target doesn't fit the kind, or null.
    public static Problem? ProblemOf(string kind, string target)
    {
        var fits = kind switch
        {
            AzureResourceKinds.AppInsights => LogsResourceId().IsMatch(target),
            AzureResourceKinds.Cosmos => CosmosEndpoint().IsMatch(target),
            AzureResourceKinds.ServiceBus => ServiceBusNamespaceId().IsMatch(target),
            AzureResourceKinds.Mongo => MongoConnectionString().IsMatch(target),
            _ => false,
        };

        return fits ? null : Problem.Invalid(Expected(kind));
    }

    // What the Settings page shows: a connection string only by its host, since it carries the key.
    public static string DisplayOf(string kind, string target)
    {
        if (kind != AzureResourceKinds.Mongo)
            return target;

        var host = MongoConnectionString().Match(target).Groups["host"].Value;

        return host.Length > 0 ? host : "mongodb://…";
    }

    private static string Expected(string kind) => kind switch
    {
        AzureResourceKinds.AppInsights => "An App Insights target is the component's or workspace's resource id: /subscriptions/…/providers/microsoft.insights/components/<name> (or Microsoft.OperationalInsights/workspaces/<name>).",
        AzureResourceKinds.Cosmos => "A Cosmos target is the account endpoint: https://<account>.documents.azure.com.",
        AzureResourceKinds.ServiceBus => "A Service Bus target is the namespace's resource id: /subscriptions/…/providers/Microsoft.ServiceBus/namespaces/<name>.",
        AzureResourceKinds.Mongo => "A Mongo target is a connection string: mongodb://… or mongodb+srv://… (use the account's read-only key).",
        _ => $"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.",
    };

    [GeneratedRegex(@"^/subscriptions/[0-9a-f-]{36}/resourceGroups/[^/]+/providers/(microsoft\.insights/components|Microsoft\.OperationalInsights/workspaces)/[^/]+/?$", RegexOptions.IgnoreCase)]
    private static partial Regex LogsResourceId();

    [GeneratedRegex(@"^https://[a-z0-9-]+\.documents\.azure\.com(:443)?/?$", RegexOptions.IgnoreCase)]
    private static partial Regex CosmosEndpoint();

    [GeneratedRegex(@"^/subscriptions/[0-9a-f-]{36}/resourceGroups/[^/]+/providers/Microsoft\.ServiceBus/namespaces/[^/]+/?$", RegexOptions.IgnoreCase)]
    private static partial Regex ServiceBusNamespaceId();

    [GeneratedRegex(@"^mongodb(\+srv)?://(?:[^@/]*@)?(?<host>[^/?]+)", RegexOptions.IgnoreCase)]
    private static partial Regex MongoConnectionString();
}
