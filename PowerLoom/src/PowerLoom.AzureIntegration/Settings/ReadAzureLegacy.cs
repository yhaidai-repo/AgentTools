namespace PowerLoom.AzureIntegration.Settings;

// Settings saved before 2026-10-14 had App Insights and Service Bus kinds, endpoints or connection strings as targets
// and a secret per resource. The rework reads Cosmos and Mongo accounts by name with the sign-in, so an old vault's
// settings are brought to the new shape on first read: those kinds go, an endpoint or host becomes its account name,
// secrets are no longer part of the model and vanish on save.
public static class ReadAzureLegacy
{
    private static readonly string[] RemovedKinds = ["appInsights", "serviceBus"];

    // True when something changed, so the caller saves the upgraded settings.
    public static bool Upgrade(ReadAzureSettings settings)
    {
        var removedKinds = RemovedKinds.Count(kind => settings.EnabledKinds.Remove(kind));
        var removedResources = settings.Resources.RemoveAll(resource => RemovedKinds.Contains(resource.Kind));
        var renamed = settings.Resources.Count(ToAccountName);

        return removedKinds + removedResources + renamed > 0;
    }

    // "https://<account>.documents.azure.com:443/" or "<account>.mongo.cosmos.azure.com:10255" → "<account>".
    private static bool ToAccountName(AzureResourceSettings resource)
    {
        var host = HostOf(resource.Target);
        var account = host.Split('.')[0];

        if (account == resource.Target)
            return false;

        resource.Target = account;
        resource.Display = account;

        return true;
    }

    private static string HostOf(string target)
    {
        var withoutScheme = target.Contains("://") ? target[(target.IndexOf("://", StringComparison.Ordinal) + 3)..] : target;

        return withoutScheme.Split('/')[0].Split(':')[0];
    }
}
