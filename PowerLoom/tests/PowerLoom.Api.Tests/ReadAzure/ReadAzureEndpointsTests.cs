using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Features.Repos.Models;

namespace PowerLoom.Api.Tests.ReadAzure;

[Collection(PowerLoomCollection.Name)]
public sealed class ReadAzureEndpointsTests(PowerLoomHost host)
{
    private const string ReadAzure = $"/api/vaults/{PowerLoomHost.Vault}/read-azure";

    [Fact]
    public async Task A_cosmos_or_mongo_account_is_added_by_its_name_and_azure_access_has_no_resources()
    {
        var cosmos = await host.Host.PostJson(new AddAzureResourceRequest("pvs-cosmos", "cosmos", "AA-Stage-Signals-Cosmos"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        var mongo = await host.Host.PostJson(new AddAzureResourceRequest("pvs-mongo", "mongo", "aa-stage-cosmos-mongo"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();

        var saved = await ReadSettingsAsync();

        Assert.Equal(new AzureResourceSummary("pvs-cosmos", "cosmos", "aa-stage-signals-cosmos", true), cosmos);
        Assert.Equal(new AzureResourceSummary("pvs-mongo", "mongo", "aa-stage-cosmos-mongo", true), mongo);
        Assert.Equal("aa-stage-signals-cosmos", saved.Find("pvs-cosmos")!.Target);

        await AddShouldFailAsync(new AddAzureResourceRequest("PVS-COSMOS", "cosmos", "other-account"), HttpStatusCode.Conflict);
        await AddShouldFailAsync(new AddAzureResourceRequest("access", "azureAccess", "anything"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("wrong-kind", "blob", "x"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("endpoint", "cosmos", "https://pvs.documents.azure.com"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("too-short", "mongo", "ab"), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Each_kind_has_its_own_switch_a_resource_switch_is_saved_and_a_removed_resource_is_gone()
    {
        await host.Host.PostJson(new AddAzureResourceRequest("switched", "cosmos", "pvs-switched"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        await host.Host.Scenario(scenario => scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/azureAccess/enabled"));

        var off = await host.Host.PutJson(new EnabledRequest(false), $"{ReadAzure}/resources/switched/enabled").Receive<AzureResourceSummary>();
        var switched = await ReadSettingsAsync();

        await host.Host.Scenario(scenario => scenario.Delete.Url($"{ReadAzure}/resources/switched"));

        var removed = await ReadSettingsAsync();

        Assert.False(off!.Enabled);
        Assert.True(switched.IsEnabled("azureAccess"));
        Assert.False(switched.IsEnabled("cosmos"));
        Assert.False(switched.Find("switched")!.Enabled);
        Assert.Null(removed.Find("switched"));

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/serviceBus/enabled");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/resources/no-such-resource/enabled");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl("/api/vaults/no-such-vault/read-azure/cosmos/enabled");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    [Fact]
    public async Task The_default_subscription_is_saved_trimmed_and_cleared_by_an_empty_value()
    {
        await host.Host.Scenario(scenario => scenario.Put.Json(new AzureSubscriptionRequest("  AA Dev ")).ToUrl($"{ReadAzure}/subscription"));

        var saved = await ReadSettingsAsync();

        await host.Host.Scenario(scenario => scenario.Put.Json(new AzureSubscriptionRequest(null)).ToUrl($"{ReadAzure}/subscription"));

        var cleared = await ReadSettingsAsync();

        Assert.Equal("AA Dev", saved.Subscription);
        Assert.Equal("", cleared.Subscription);

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new AzureSubscriptionRequest(new string('x', 121))).ToUrl($"{ReadAzure}/subscription");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
    }

    [Fact]
    public async Task The_user_sign_in_starts_at_the_runner_reports_its_status_and_signs_out()
    {
        var login = host.Host.Services.GetRequiredService<FakeAzureUserLogin>();

        var started = await host.Host.PostJson(new { }, $"{ReadAzure}/user-login/start").Receive<AzureLoginStart>();
        var pending = await host.Host.GetAsJson<AzureLoginStatus>($"{ReadAzure}/user-login/{started!.FlowId}");

        login.Status = new AzureLoginStatus("done", "sam@x.io", null);

        var done = await host.Host.GetAsJson<AzureLoginStatus>($"{ReadAzure}/user-login/flow-1");

        await host.Host.Scenario(scenario => scenario.Delete.Url($"{ReadAzure}/user-login"));

        await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url($"{ReadAzure}/user-login/no-such-flow");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadGateway);
        });

        Assert.Equal(PowerLoomHost.Vault, login.StartedVault);
        Assert.Equal("ABCD-1234", started.UserCode);
        Assert.Equal("pending", pending!.Status);
        Assert.Equal("sam@x.io", done!.Username);
        Assert.Equal(PowerLoomHost.Vault, login.SignedOutVault);
    }

    private async Task AddShouldFailAsync(AddAzureResourceRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request).ToUrl($"{ReadAzure}/resources");
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task<ReadAzureSettings> ReadSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<ReadAzureSettingsStore>().ReadAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
