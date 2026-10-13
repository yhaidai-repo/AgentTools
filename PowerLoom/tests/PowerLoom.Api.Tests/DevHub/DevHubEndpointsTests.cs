using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;
using PowerLoom.DevHubIntegration.Settings;

namespace PowerLoom.Api.Tests.DevHub;

[Collection(PowerLoomCollection.Name)]
public sealed class DevHubEndpointsTests(PowerLoomHost host)
{
    private const string DevHubPath = $"/api/vaults/{PowerLoomHost.Vault}/devhub";

    private const string Token = "0123456789abcdef0123456789abcdef";

    [Fact]
    public async Task Saved_settings_keep_the_token_and_return_only_whether_one_is_set()
    {
        var summary = await host.Host.PutJson(new SaveDevHubRequest(true, "http://host.docker.internal:47811/", Token), DevHubPath).Receive<DevHubSummary>();

        var saved = await ReadSettingsAsync();

        Assert.Equal(new DevHubSummary(true, "http://host.docker.internal:47811", true), summary);
        Assert.Equal(Token, saved.Token);
    }

    [Fact]
    public async Task An_empty_token_keeps_the_saved_one_and_an_empty_url_means_the_default()
    {
        await host.Host.PutJson(new SaveDevHubRequest(true, "http://other:1", Token), DevHubPath).Receive<DevHubSummary>();

        var summary = await host.Host.PutJson(new SaveDevHubRequest(false, " ", null), DevHubPath).Receive<DevHubSummary>();
        var saved = await ReadSettingsAsync();

        Assert.Equal(new DevHubSummary(false, DevHubSettings.DefaultUrl, true), summary);
        Assert.Equal(Token, saved.Token);
    }

    [Fact]
    public async Task Switching_on_without_a_token_and_a_url_that_is_not_http_are_refused()
    {
        using (var scope = host.Host.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<DevHubSettingsStore>().SaveAsync(PowerLoomHost.Vault, new DevHubSettings(), CancellationToken.None);

        await SaveShouldFailAsync(new SaveDevHubRequest(true, null, null), HttpStatusCode.BadRequest);
        await SaveShouldFailAsync(new SaveDevHubRequest(false, "ftp://devhub", Token), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task The_test_asks_the_runner_with_the_typed_values_or_the_saved_ones()
    {
        var tester = host.Host.Services.GetRequiredService<FakeDevHubTester>();

        await host.Host.PutJson(new SaveDevHubRequest(true, "http://saved:47811", Token), DevHubPath).Receive<DevHubSummary>();

        var withSaved = await host.Host.PostJson(new TestDevHubRequest(null, null), $"{DevHubPath}/test").Receive<DevHubCheck>();
        var savedTarget = tester.LastTarget;
        var withTyped = await host.Host.PostJson(new TestDevHubRequest("http://typed:1", "typed-token"), $"{DevHubPath}/test").Receive<DevHubCheck>();

        Assert.Equal(tester.Answer, withSaved);
        Assert.Equal(new DevHubTarget("http://saved:47811", Token), savedTarget);
        Assert.Equal(tester.Answer, withTyped);
        Assert.Equal(new DevHubTarget("http://typed:1", "typed-token"), tester.LastTarget);
    }

    [Fact]
    public async Task An_unknown_vault_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveDevHubRequest(false, null, null)).ToUrl("/api/vaults/no-such-vault/devhub");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task SaveShouldFailAsync(SaveDevHubRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(request).ToUrl(DevHubPath);
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task<DevHubSettings> ReadSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<DevHubSettingsStore>().ReadAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
