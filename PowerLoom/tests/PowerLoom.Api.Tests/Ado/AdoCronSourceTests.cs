using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Scheduling;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Api.Tests.Ado;

[Collection(PowerLoomCollection.Name)]
public sealed class AdoCronSourceTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_vault_s_enabled_features_give_the_cron_lines()
    {
        await ConfigureAsync(enabled: true, adoSync: true, pullRequests: false);
        var source = host.Host.Services.GetServices<ICronSource>().OfType<AdoCronSource>().Single();

        var entries = await source.EntriesAsync(CancellationToken.None);
        var entry = Assert.Single(entries, entry => entry.Key.EndsWith($":{PowerLoomHost.Vault}"));

        Assert.Equal(($"sync:{PowerLoomHost.Vault}", "*/7 * * * *"), (entry.Key, entry.Cron));
        Assert.Equal(new SyncPbis(PowerLoomHost.Vault, null), entry.Message);
        Assert.DoesNotContain(entries, entry => entry.Message is SyncPullRequests);

        await ConfigureAsync(enabled: false, adoSync: true, pullRequests: true);

        Assert.DoesNotContain(await source.EntriesAsync(CancellationToken.None), entry => entry.Key.EndsWith($":{PowerLoomHost.Vault}"));
    }

    private async Task ConfigureAsync(bool enabled, bool adoSync, bool pullRequests)
    {
        using var scope = host.Host.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<AdoSettingsStore>();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await store.SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = enabled, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
        await store.SaveSyncAsync(PowerLoomHost.Vault, new SyncSettings { Cron = "*/7 * * * *" }, CancellationToken.None);
        await VaultFeatures.SetAsync(db, PowerLoomHost.Vault, VaultFeatures.AdoSync, adoSync, CancellationToken.None);
        await VaultFeatures.SetAsync(db, PowerLoomHost.Vault, VaultFeatures.PullRequests, pullRequests, CancellationToken.None);
    }
}
