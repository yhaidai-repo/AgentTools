using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.AiProviders;
using PowerLoom.Features.AiProviders.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.AiProviders;

[Collection(PowerLoomCollection.Name)]
public sealed class AiProvidersTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string TokenPath = "/api/ai-providers/claude/token";
    private const string Token = "sk-ant-oat01-test-token";

    public Task InitializeAsync() => ResetAsync();

    public Task DisposeAsync() => ResetAsync();

    [Fact]
    public async Task Claude_is_not_connected_without_a_saved_token_or_the_runner_s_env_token()
    {
        var providers = await host.Host.GetAsJson<ProviderStatus[]>("/api/ai-providers");

        Assert.Equal([new ProviderStatus("anthropic", "Claude", false, null)], providers!);
    }

    [Fact]
    public async Task A_saved_token_connects_Claude_and_is_stored_for_the_runner_but_never_returned()
    {
        var saved = await host.Host.PutJson(new SaveClaudeTokenRequest($"  {Token}\n"), TokenPath).Receive<ProviderStatus>();
        var body = await host.Host.GetAsText("/api/ai-providers");
        var stored = await WithDbAsync(db => GlobalSettings.ReadAsync<ClaudeTokenSetting>(db, ClaudeConnection.TokenKey, CancellationToken.None));

        Assert.Equal(new ProviderStatus("anthropic", "Claude", true, ProviderSource.Settings), saved);
        Assert.Equal(Token, stored!.Token);
        Assert.Contains("\"source\":\"settings\"", body);
        Assert.DoesNotContain(Token, body);
    }

    [Fact]
    public async Task Without_a_saved_token_the_runner_s_env_token_is_the_fallback()
    {
        await WithDbAsync(db => GlobalSettings.SaveAsync(db, ClaudeConnection.EnvTokenKey, new EnvTokenReport { Present = true }, CancellationToken.None));
        await host.Host.PutJson(new SaveClaudeTokenRequest(Token), TokenPath).Receive<ProviderStatus>();

        var removed = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url(TokenPath);
            scenario.StatusCodeShouldBeOk();
        });

        Assert.Equal(new ProviderStatus("anthropic", "Claude", true, ProviderSource.Env), removed.ReadAsJson<ProviderStatus>());
        Assert.Null(await WithDbAsync(db => GlobalSettings.ReadRawAsync(db, ClaudeConnection.TokenKey, CancellationToken.None)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    [InlineData("two words")]
    public async Task A_missing_or_broken_token_is_refused(string? token)
    {
        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveClaudeTokenRequest(token)).ToUrl(TokenPath);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        Assert.Contains("claude setup-token", await refused.ReadAsTextAsync());
    }

    private Task ResetAsync() => WithDbAsync(async db =>
    {
        await GlobalSettings.DeleteAsync(db, ClaudeConnection.TokenKey, CancellationToken.None);
        await GlobalSettings.DeleteAsync(db, ClaudeConnection.EnvTokenKey, CancellationToken.None);
    });

    private async Task<T> WithDbAsync<T>(Func<PowerLoomDbContext, Task<T>> action)
    {
        using var scope = host.Host.Services.CreateScope();

        return await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }

    private async Task WithDbAsync(Func<PowerLoomDbContext, Task> action)
    {
        using var scope = host.Host.Services.CreateScope();

        await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }
}
