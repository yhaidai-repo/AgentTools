using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.LocalStackIntegration.Features.Bridge.Models;
using PowerLoom.LocalStackIntegration.Settings;

namespace PowerLoom.Api.Tests.LocalStack;

[Collection(PowerLoomCollection.Name)]
public sealed class LocalStackEndpointsTests(PowerLoomHost host)
{
    private const string LocalStack = $"/api/vaults/{PowerLoomHost.Vault}/local-stack";

    private const string Token = "0123456789abcdef0123456789abcdef";

    [Fact]
    public async Task Saved_settings_keep_the_token_and_return_only_whether_one_is_set()
    {
        var summary = await host.Host.PutJson(new SaveLocalStackRequest(true, "http://host.docker.internal:47811/", Token), LocalStack).Receive<LocalStackSummary>();

        var saved = await ReadSettingsAsync();

        Assert.Equal(new LocalStackSummary(true, "http://host.docker.internal:47811", true), summary);
        Assert.Equal(Token, saved.Token);
    }

    [Fact]
    public async Task An_empty_token_keeps_the_saved_one_and_an_empty_url_means_the_default()
    {
        await host.Host.PutJson(new SaveLocalStackRequest(true, "http://other:1", Token), LocalStack).Receive<LocalStackSummary>();

        var summary = await host.Host.PutJson(new SaveLocalStackRequest(false, " ", null), LocalStack).Receive<LocalStackSummary>();
        var saved = await ReadSettingsAsync();

        Assert.Equal(new LocalStackSummary(false, LocalStackSettings.DefaultUrl, true), summary);
        Assert.Equal(Token, saved.Token);
    }

    [Fact]
    public async Task Switching_on_without_a_token_and_a_url_that_is_not_http_are_refused()
    {
        using (var scope = host.Host.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<LocalStackSettingsStore>().SaveAsync(PowerLoomHost.Vault, new LocalStackSettings(), CancellationToken.None);

        await SaveShouldFailAsync(new SaveLocalStackRequest(true, null, null), HttpStatusCode.BadRequest);
        await SaveShouldFailAsync(new SaveLocalStackRequest(false, "ftp://bridge", Token), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task The_test_asks_the_runner_with_the_typed_values_or_the_saved_ones()
    {
        var tester = host.Host.Services.GetRequiredService<FakeLocalStackTester>();

        await host.Host.PutJson(new SaveLocalStackRequest(true, "http://saved:47811", Token), LocalStack).Receive<LocalStackSummary>();

        var withSaved = await host.Host.PostJson(new TestLocalStackRequest(null, null), $"{LocalStack}/test").Receive<LocalStackCheck>();
        var savedTarget = tester.LastTarget;
        var withTyped = await host.Host.PostJson(new TestLocalStackRequest("http://typed:1", "typed-token"), $"{LocalStack}/test").Receive<LocalStackCheck>();

        Assert.Equal(tester.Answer, withSaved);
        Assert.Equal(new LocalStackTarget("http://saved:47811", Token), savedTarget);
        Assert.Equal(tester.Answer, withTyped);
        Assert.Equal(new LocalStackTarget("http://typed:1", "typed-token"), tester.LastTarget);
    }

    [Fact]
    public async Task An_unknown_vault_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveLocalStackRequest(false, null, null)).ToUrl("/api/vaults/no-such-vault/local-stack");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task SaveShouldFailAsync(SaveLocalStackRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(request).ToUrl(LocalStack);
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task<LocalStackSettings> ReadSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<LocalStackSettingsStore>().ReadAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
