namespace PowerLoom.AzureIntegration.Settings;

// Settings saved before 2026-10-14 had an App Insights kind, endpoints or connection strings as targets and a
// secret per resource. The rework reads Cosmos accounts (also Cosmos DB for MongoDB) by name with the sign-in, so an
// old vault's settings are brought to the new shape on first read: App Insights goes, a Cosmos endpoint or host
// becomes its account name and loses its stored key. Service Bus and Mongo servers outside Cosmos keep their host
// and their connection string.
public static class ReadAzureLegacy
{
    private static readonly string[] RemovedKinds = ["appInsights"];

    // The hosts Cosmos DB answers on; a Mongo resource on any other host is a server of its own.
    private static readonly string[] CosmosHosts = [".documents.azure.com", ".cosmos.azure.com"];

    // True when something changed, so the caller saves the upgraded settings.
    public static bool Upgrade(ReadAzureSettings settings)
    {
        var removedKinds = RemovedKinds.Count(kind => settings.EnabledKinds.Remove(kind));
        var removedResources = settings.Resources.RemoveAll(resource => RemovedKinds.Contains(resource.Kind));
        var accounts = settings.Resources.Where(IsCosmosAccount).ToList();
        var renamed = accounts.Count(ToAccountName);
        var cleared = accounts.Count(ClearSecret);

        return removedKinds + removedResources + renamed + cleared > 0;
    }

    private static bool IsCosmosAccount(AzureResourceSettings resource)
    {
        if (resource.Kind == AzureResourceKinds.Cosmos)
            return true;

        return resource.Kind == AzureResourceKinds.Mongo && CosmosHosts.Any(host => HostOf(resource.Target).EndsWith(host, StringComparison.OrdinalIgnoreCase));
    }

    // "https://<account>.documents.azure.com:443/" or "<account>.mongo.cosmos.azure.com:10255" → "<account>".
    private static bool ToAccountName(AzureResourceSettings resource)
    {
        var account = HostOf(resource.Target).Split('.')[0];

        if (account == resource.Target)
            return false;

        resource.Target = account;
        resource.Display = account;

        return true;
    }

    private static bool ClearSecret(AzureResourceSettings resource)
    {
        if (resource.Secret.Length == 0)
            return false;

        resource.Secret = "";

        return true;
    }

    private static string HostOf(string target)
    {
        var withoutScheme = target.Contains("://") ? target[(target.IndexOf("://", StringComparison.Ordinal) + 3)..] : target;

        return withoutScheme.Split('/')[0].Split(':')[0];
    }
}
