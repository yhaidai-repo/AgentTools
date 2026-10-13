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
    private const string Logs = "/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/pvs-stage/providers/microsoft.insights/components/pvs-api";
    private const string Mongo = "mongodb://pvs-mongo:k3y==@pvs-mongo.mongo.cosmos.azure.com:10255/?ssl=true";
    private const string Bus = "Endpoint=sb://pvs-bus.servicebus.windows.net/;SharedAccessKeyName=listen;SharedAccessKey=k3y=";

    [Fact]
    public async Task A_resource_is_shown_by_its_target_and_a_connection_string_only_by_its_host()
    {
        var logs = await host.Host.PostJson(new AddAzureResourceRequest("pvs-logs", "appInsights", Logs, null), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        var cosmos = await host.Host.PostJson(new AddAzureResourceRequest("pvs-cosmos", "cosmos", "https://pvs.documents.azure.com", "r0-key=="), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        var bus = await host.Host.PostJson(new AddAzureResourceRequest("pvs-bus", "serviceBus", null, Bus), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        var mongo = await host.Host.PostJson(new AddAzureResourceRequest("pvs-mongo", "mongo", null, Mongo), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();

        var saved = await ReadSettingsAsync();

        Assert.Equal(new AzureResourceSummary("pvs-logs", "appInsights", Logs, true), logs);
        Assert.Equal(new AzureResourceSummary("pvs-cosmos", "cosmos", "https://pvs.documents.azure.com", true), cosmos);
        Assert.Equal(new AzureResourceSummary("pvs-bus", "serviceBus", "pvs-bus.servicebus.windows.net", true), bus);
        Assert.Equal(new AzureResourceSummary("pvs-mongo", "mongo", "pvs-mongo.mongo.cosmos.azure.com:10255", true), mongo);
        Assert.Equal(("r0-key==", Bus, Mongo, ""), (saved.Find("pvs-cosmos")!.Secret, saved.Find("pvs-bus")!.Secret, saved.Find("pvs-mongo")!.Secret, saved.Find("pvs-logs")!.Secret));
    }

    [Fact]
    public async Task A_target_that_does_not_fit_its_kind_a_taken_name_and_an_unknown_kind_are_refused()
    {
        await host.Host.PostJson(new AddAzureResourceRequest("taken", "cosmos", "https://pvs.documents.azure.com", "k"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();

        await AddShouldFailAsync(new AddAzureResourceRequest("TAKEN", "cosmos", "https://pvs.documents.azure.com", "k"), HttpStatusCode.Conflict);
        await AddShouldFailAsync(new AddAzureResourceRequest("wrong-kind", "blob", "https://x", null), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("logs-as-url", "appInsights", "https://portal.azure.com/x", null), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("cosmos-as-id", "cosmos", Logs, "k"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("cosmos-no-key", "cosmos", "https://pvs.documents.azure.com", ""), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("bus-as-fqdn", "serviceBus", null, "pvs.servicebus.windows.net"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("mongo-as-sql", "mongo", null, "Server=x;Database=y"), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Each_kind_has_its_own_switch_a_resource_switch_is_saved_and_a_removed_resource_is_gone()
    {
        await host.Host.PostJson(new AddAzureResourceRequest("switched", "serviceBus", null, Bus), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        await host.Host.Scenario(scenario => scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/serviceBus/enabled"));

        var off = await host.Host.PutJson(new EnabledRequest(false), $"{ReadAzure}/resources/switched/enabled").Receive<AzureResourceSummary>();
        var switched = await ReadSettingsAsync();

        await host.Host.Scenario(scenario => scenario.Delete.Url($"{ReadAzure}/resources/switched"));

        var removed = await ReadSettingsAsync();

        Assert.False(off!.Enabled);
        Assert.True(switched.IsEnabled("serviceBus"));
        Assert.False(switched.IsEnabled("cosmos"));
        Assert.False(switched.Find("switched")!.Enabled);
        Assert.Null(removed.Find("switched"));

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/blob/enabled");
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
