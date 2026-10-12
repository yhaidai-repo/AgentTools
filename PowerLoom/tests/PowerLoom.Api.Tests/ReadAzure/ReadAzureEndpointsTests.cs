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
    private const string Tenant = "11111111-1111-1111-1111-111111111111";
    private const string Client = "22222222-2222-2222-2222-222222222222";
    private const string Logs = "/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/pvs-stage/providers/microsoft.insights/components/pvs-api";
    private const string Mongo = "mongodb://pvs-mongo:k3y==@pvs-mongo.mongo.cosmos.azure.com:10255/?ssl=true";

    [Fact]
    public async Task The_identity_keeps_its_secret_when_the_field_is_empty_and_the_test_uses_it()
    {
        var tester = host.Host.Services.GetRequiredService<FakeAzureIdentityTester>();

        await host.Host.PutJson(new SaveAzureIdentityRequest(Tenant, Client, "s3cret-1"), $"{ReadAzure}/identity").Receive<AzureIdentitySummary>();
        await host.Host.PutJson(new SaveAzureIdentityRequest(Tenant, Client, ""), $"{ReadAzure}/identity").Receive<AzureIdentitySummary>();

        var saved = (await ReadSettingsAsync()).Identity;
        var check = await host.Host.PostJson(new TestAzureIdentityRequest(Tenant, Client, null), $"{ReadAzure}/identity/test").Receive<AzureIdentityCheck>();

        Assert.Equal("s3cret-1", saved!.ClientSecret);
        Assert.Equal(tester.Answer, check);
        Assert.Equal("s3cret-1", tester.LastIdentity!.ClientSecret);
    }

    [Fact]
    public async Task A_first_identity_without_a_secret_or_with_a_bad_id_is_refused()
    {
        await IdentityShouldFailAsync(new SaveAzureIdentityRequest(Tenant, "not-a-guid", "s3cret"), HttpStatusCode.BadRequest);

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new TestAzureIdentityRequest(Tenant, Client, " ")).ToUrl("/api/vaults/no-such-vault/read-azure/identity/test");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    [Fact]
    public async Task A_resource_is_shown_by_its_target_and_a_mongo_string_only_by_its_host()
    {
        var logs = await host.Host.PostJson(new AddAzureResourceRequest("pvs-logs", "appInsights", Logs), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        var mongo = await host.Host.PostJson(new AddAzureResourceRequest("pvs-mongo", "mongo", Mongo), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();

        var saved = await ReadSettingsAsync();

        Assert.Equal(new AzureResourceSummary("pvs-logs", "appInsights", Logs, true), logs);
        Assert.Equal(new AzureResourceSummary("pvs-mongo", "mongo", "pvs-mongo.mongo.cosmos.azure.com:10255", true), mongo);
        Assert.Equal(Mongo, saved.Find("pvs-mongo")!.Target);
    }

    [Fact]
    public async Task A_target_that_does_not_fit_its_kind_a_taken_name_and_an_unknown_kind_are_refused()
    {
        await host.Host.PostJson(new AddAzureResourceRequest("taken", "cosmos", "https://pvs.documents.azure.com"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();

        await AddShouldFailAsync(new AddAzureResourceRequest("TAKEN", "cosmos", "https://pvs.documents.azure.com"), HttpStatusCode.Conflict);
        await AddShouldFailAsync(new AddAzureResourceRequest("wrong-kind", "blob", "https://x"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("logs-as-url", "appInsights", "https://portal.azure.com/x"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("cosmos-as-id", "cosmos", Logs), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("bus-as-fqdn", "serviceBus", "pvs.servicebus.windows.net"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddAzureResourceRequest("mongo-as-sql", "mongo", "Server=x;Database=y"), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task The_vault_switch_and_a_resource_switch_are_saved_and_a_removed_resource_is_gone()
    {
        await host.Host.PostJson(new AddAzureResourceRequest("switched", "serviceBus", "/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/rg/providers/Microsoft.ServiceBus/namespaces/pvs-bus"), $"{ReadAzure}/resources").Receive<AzureResourceSummary>();
        await host.Host.Scenario(scenario => scenario.Put.Json(new EnabledRequest(true)).ToUrl(ReadAzure));

        var off = await host.Host.PutJson(new EnabledRequest(false), $"{ReadAzure}/resources/switched/enabled").Receive<AzureResourceSummary>();
        var switched = await ReadSettingsAsync();

        await host.Host.Scenario(scenario => scenario.Delete.Url($"{ReadAzure}/resources/switched"));

        var removed = await ReadSettingsAsync();

        Assert.False(off!.Enabled);
        Assert.True(switched.Enabled);
        Assert.False(switched.Find("switched")!.Enabled);
        Assert.Null(removed.Find("switched"));

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadAzure}/resources/no-such-resource/enabled");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task IdentityShouldFailAsync(SaveAzureIdentityRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(request).ToUrl($"{ReadAzure}/identity");
            scenario.StatusCodeShouldBe(status);
        });
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
