using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// What each kind needs, checked at save so a typo is an answer here and not a failed agent run (user decision
// 2026-10-13: keys per resource). Target is public; Secret is the key or connection string, never shown again.
public static partial class AzureTargets
{
    public static Outcome<AzureResourceTarget> Resolve(string kind, string target, string secret) => kind switch
    {
        AzureResourceKinds.AppInsights => Public(LogsResourceId(), target, "An App Insights target is the component's or workspace's resource id: /subscriptions/…/providers/microsoft.insights/components/<name> (or Microsoft.OperationalInsights/workspaces/<name>). Logs are read with your own account (Sign in above)."),
        AzureResourceKinds.Cosmos => Keyed(CosmosEndpoint(), target, secret, "A Cosmos target is the account endpoint, https://<account>.documents.azure.com, and the secret its read-only key (Keys → Read-only Keys)."),
        AzureResourceKinds.ServiceBus => ConnectionString(ServiceBusConnectionString(), secret, "A Service Bus secret is a connection string of a policy with Listen only: Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=…;SharedAccessKey=…"),
        AzureResourceKinds.Mongo => ConnectionString(MongoConnectionString(), secret, "A Mongo secret is the read-only connection string: mongodb://… or mongodb+srv://…"),
        _ => Outcome<AzureResourceTarget>.Failure(Problem.Invalid($"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.")),
    };

    // A public id, no secret: the vault's sign-in or service principal reads it.
    private static Outcome<AzureResourceTarget> Public(Regex shape, string target, string expected)
    {
        return shape.IsMatch(target) ? Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(target, "", target)) : Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));
    }

    // A public endpoint plus a key.
    private static Outcome<AzureResourceTarget> Keyed(Regex shape, string target, string secret, string expected)
    {
        if (!shape.IsMatch(target) || secret.Length == 0)
            return Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));

        return Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(target, secret, target));
    }

    // A connection string carries both: the host becomes the target the page shows.
    private static Outcome<AzureResourceTarget> ConnectionString(Regex shape, string secret, string expected)
    {
        var match = shape.Match(secret);

        if (!match.Success)
            return Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));

        var host = match.Groups["host"].Value;

        return Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(host, secret, host));
    }

    [GeneratedRegex(@"^/subscriptions/[0-9a-f-]{36}/resourceGroups/[^/]+/providers/(microsoft\.insights/components|Microsoft\.OperationalInsights/workspaces)/[^/]+/?$", RegexOptions.IgnoreCase)]
    private static partial Regex LogsResourceId();

    [GeneratedRegex(@"^https://[a-z0-9-]+\.documents\.azure\.com(:443)?/?$", RegexOptions.IgnoreCase)]
    private static partial Regex CosmosEndpoint();

    [GeneratedRegex(@"^Endpoint=sb://(?<host>[^/;]+)/?;.*SharedAccessKeyName=[^;]+;.*SharedAccessKey=[^;]+", RegexOptions.IgnoreCase)]
    private static partial Regex ServiceBusConnectionString();

    [GeneratedRegex(@"^mongodb(\+srv)?://(?:[^@/]*@)?(?<host>[^/?]+)", RegexOptions.IgnoreCase)]
    private static partial Regex MongoConnectionString();
}
