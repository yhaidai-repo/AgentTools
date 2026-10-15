using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// What a kind's resource is, checked at save so a typo is an answer here and not a failed agent run (user decisions
// 2026-10-14/15): a Cosmos DB account name for Cosmos, and for Mongo either a Cosmos DB for MongoDB account name
// (keys come with the sign-in, nothing stored) or the connection string of any other Mongo server; a Listen-only
// connection string for Service Bus.
public static partial class AzureTargets
{
    public static Outcome<AzureResourceTarget> Resolve(string kind, string target, string secret) => kind switch
    {
        AzureResourceKinds.Cosmos => AccountName(target, "A Cosmos DB resource is the account name (3–44 lowercase letters, digits and hyphens), e.g. aa-stage-signals-cosmos."),
        AzureResourceKinds.Mongo => secret.Length > 0 ? MongoConnectionString(secret) : AccountName(target, "A Mongo resource is a Cosmos DB for MongoDB account name (3–44 lowercase letters, digits and hyphens), e.g. aa-stage-cosmos-mongo, or the connection string of another Mongo server: mongodb://user:password@host:27017/…"),
        AzureResourceKinds.ServiceBus => ServiceBusConnectionString(secret),
        AzureResourceKinds.AzureAccess => Outcome<AzureResourceTarget>.Failure(Problem.Invalid("Azure access has no resources: agents read whatever the signed-in account sees.")),
        _ => Outcome<AzureResourceTarget>.Failure(Problem.Invalid($"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.")),
    };

    private static Outcome<AzureResourceTarget> AccountName(string target, string expected)
    {
        var account = target.ToLowerInvariant();

        return CosmosAccountName().IsMatch(account) ? Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(account, "", account)) : Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));
    }

    // A Mongo server outside Cosmos: its host (and port) becomes the target the page shows and agents pick.
    private static Outcome<AzureResourceTarget> MongoConnectionString(string secret)
    {
        return HostOf(MongoUri(), secret, "A Mongo connection string starts with mongodb:// or mongodb+srv://, e.g. mongodb://reader:password@10.35.15.93:27017/?authMechanism=SCRAM-SHA-256.");
    }

    // The connection string carries the namespace: its host becomes the target the page shows and agents pick.
    private static Outcome<AzureResourceTarget> ServiceBusConnectionString(string secret)
    {
        return HostOf(ServiceBusUri(), secret, "A Service Bus resource is the connection string of a shared access policy with Listen only: Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=…;SharedAccessKey=…");
    }

    private static Outcome<AzureResourceTarget> HostOf(Regex shape, string secret, string expected)
    {
        var match = shape.Match(secret);

        if (!match.Success)
            return Outcome<AzureResourceTarget>.Failure(Problem.Invalid(expected));

        var host = match.Groups["host"].Value.ToLowerInvariant();

        return Outcome<AzureResourceTarget>.Success(new AzureResourceTarget(host, secret, host));
    }

    [GeneratedRegex(@"^[a-z0-9](?:[a-z0-9-]{1,42}[a-z0-9])$")]
    private static partial Regex CosmosAccountName();

    [GeneratedRegex(@"^mongodb(\+srv)?://(?:[^@/]*@)?(?<host>[^/?]+)", RegexOptions.IgnoreCase)]
    private static partial Regex MongoUri();

    [GeneratedRegex(@"^Endpoint=sb://(?<host>[^/;]+)/?;.*SharedAccessKeyName=[^;]+;.*SharedAccessKey=[^;]+", RegexOptions.IgnoreCase)]
    private static partial Regex ServiceBusUri();
}
