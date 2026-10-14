namespace PowerLoom.AzureIntegration.Settings;

// Settings saved before 2026-10-14 had an App Insights kind, endpoints or connection strings as targets and a
// secret per resource. The rework reads Cosmos and Mongo accounts by name with the sign-in, so an old vault's
// settings are brought to the new shape on first read: App Insights goes, a Cosmos or Mongo endpoint becomes its
// account name and loses its stored key. Service Bus keeps its host and its connection string.
public static class ReadAzureLegacy
{
    private static readonly string[] RemovedKinds = ["appInsights"];
    private static readonly string[] KeyedByAccount = [AzureResourceKinds.Cosmos, AzureResourceKinds.Mongo];

    // True when something changed, so the caller saves the upgraded settings.
    public static bool Upgrade(ReadAzureSettings settings)
    {
        var removedKinds = RemovedKinds.Count(kind => settings.EnabledKinds.Remove(kind));
        var removedResources = settings.Resources.RemoveAll(resource => RemovedKinds.Contains(resource.Kind));
        var accounts = settings.Resources.Where(resource => KeyedByAccount.Contains(resource.Kind)).ToList();
        var renamed = accounts.Count(ToAccountName);
        var cleared = accounts.Count(ClearSecret);

        return removedKinds + removedResources + renamed + cleared > 0;
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
