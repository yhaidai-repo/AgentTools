using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.Connection.Models;
using PowerLoom.AdoIntegration.Features.Settings.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Api.Tests.Ado;

[Collection(PowerLoomCollection.Name)]
public sealed class ConnectionEndpointsTests(PowerLoomHost host)
{
    private const string Connection = $"/api/vaults/{PowerLoomHost.Vault}/ado/connection";

    [Fact]
    public async Task Saving_keeps_the_token_when_the_field_is_empty_and_the_test_uses_it()
    {
        host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client.QueryResult = [1, 2, 3];

        await host.Host.PutJson(new SaveConnectionRequest(true, "https://dev.azure.com/org", "Proj", "Team", "sam@x.io", "token-1"), Connection).Receive<SavedConnection>();
        await host.Host.PutJson(new SaveConnectionRequest(false, "https://dev.azure.com/org", "Proj", "Team", "sam@x.io", ""), Connection).Receive<SavedConnection>();

        var saved = await ReadAdoAsync();
        var check = await host.Host.PostJson(new TestConnectionRequest("https://dev.azure.com/org", "Proj", "Team", null), $"{Connection}/test").Receive<ConnectionCheck>();
        var factory = host.Host.Services.GetRequiredService<FakeAdoClientFactory>();

        Assert.Equal("token-1", saved!.Pat);
        Assert.False(saved.Enabled);
        Assert.True(check!.Ok);
        Assert.Equal("Connected. Current sprint Sprint 7: 3 PBIs/bugs in any state.", check.Message);
        Assert.Equal("token-1", factory.LastConnection!.Pat);
    }

    [Fact]
    public async Task A_first_save_without_a_token_is_refused_and_settings_switch_the_feature()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveConnectionRequest(true, "https://dev.azure.com/org", "Proj", "Team", "sam@x.io", "")).ToUrl("/api/vaults/no-such-vault/ado/connection");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });

        await host.Host.PutJson(new PbiSyncSettingsRequest(true, "*/10 * * * *", 50, ""), $"/api/vaults/{PowerLoomHost.Vault}/ado/pbi-sync-settings").Receive<SavedSettings>();

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new PbiSyncSettingsRequest(true, "every day", 50, "")).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/ado/pbi-sync-settings");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var sync = await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().ReadSyncAsync(PowerLoomHost.Vault, CancellationToken.None);

        Assert.Equal(("*/10 * * * *", 50, "current"), (sync.Cron, sync.MaxItemsPerRun, sync.Sprint));
        Assert.True(await VaultFeatures.IsOnAsync(db, PowerLoomHost.Vault, VaultFeatures.AdoSync, CancellationToken.None));
    }

    private async Task<AdoSettings?> ReadAdoAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().ReadAdoAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
