using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// What a kind's resource is, checked at save so a typo is an answer here and not a failed agent run: a Cosmos DB
// account name for Cosmos and Mongo (keys come with the sign-in, nothing stored), a Listen-only connection string
// for Service Bus (user decisions 2026-10-14).
public static partial class AzureTargets
{
    public static Outcome<AzureResourceTarget> Resolve(string kind, string target, string secret) => kind switch
    {
        AzureResourceKinds.Cosmos => AccountName(target, "A Cosmos DB resource is the account name (3–44 lowercase letters, digits and hyphens), e.g. aa-stage-signals-cosmos."),
        AzureResourceKinds.Mongo => AccountName(target, "A Mongo resource is the Cosmos DB for MongoDB account name (3–44 lowercase letters, digits and hyphens), e.g. aa-stage-cosmos-mongo."),
        AzureResourceKinds.ServiceBus => ConnectionString(secret),
        AzureResourceKinds.AzureAccess => Outcome<AzureResourceTarget>.Failure(Problem.Invalid("Azure access has no resources: agents read whatever the signed-in account sees.")),
        _ => Outcome<AzureResourceTarget>.Failure(Problem.Invalid($"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.")),
    };

    private static Outcome<AzureResourceTarget> AccountName(string target, string expected)
    {
        var account = target.ToLowerInvariant();

        return CosmosAccountName().IsMatch(account) ? Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(account, "", account)) : Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));
    }

    // The connection string carries the namespace: its host becomes the target the page shows and agents pick.
    private static Outcome<AzureResourceTarget> ConnectionString(string secret)
    {
        var match = ServiceBusConnectionString().Match(secret);

        if (!match.Success)
            return Outcome<AzureResourceTarget>.Failure(Problem.Invalid("A Service Bus resource is the connection string of a shared access policy with Listen only: Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=…;SharedAccessKey=…"));

        var host = match.Groups["host"].Value.ToLowerInvariant();

        return Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(host, secret, host));
    }

    [GeneratedRegex(@"^[a-z0-9](?:[a-z0-9-]{1,42}[a-z0-9])$")]
    private static partial Regex CosmosAccountName();

    [GeneratedRegex(@"^Endpoint=sb://(?<host>[^/;]+)/?;.*SharedAccessKeyName=[^;]+;.*SharedAccessKey=[^;]+", RegexOptions.IgnoreCase)]
    private static partial Regex ServiceBusConnectionString();
}
