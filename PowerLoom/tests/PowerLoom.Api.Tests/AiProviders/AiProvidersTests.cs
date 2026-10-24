using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
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
    private const string CodexLoginPath = "/api/ai-providers/codex/login";

    private static readonly ProviderStatus CodexNotConnected = new("openai-codex", "Codex", false, null);

    private FakeCodexLogin Codex => host.Host.Services.GetRequiredService<FakeCodexLogin>();

    public Task InitializeAsync() => ResetAsync();

    public Task DisposeAsync() => ResetAsync();

    [Fact]
    public async Task Claude_is_not_connected_without_a_saved_token_or_the_runner_s_env_token()
    {
        var providers = await host.Host.GetAsJson<ProviderStatus[]>("/api/ai-providers");

        Assert.Equal([new ProviderStatus("anthropic", "Claude", false, null), CodexNotConnected], providers!);
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

    [Fact]
    public async Task Codex_is_connected_while_the_runner_s_Codex_home_holds_a_login_and_not_while_the_runner_is_away()
    {
        Codex.Connected = true;
        var connected = await host.Host.GetAsJson<ProviderStatus[]>("/api/ai-providers");

        Codex.Unreachable = true;
        var away = await host.Host.GetAsJson<ProviderStatus[]>("/api/ai-providers");

        Assert.Equal(new ProviderStatus("openai-codex", "Codex", true, ProviderSource.Settings), connected![1]);
        Assert.Equal(CodexNotConnected, away![1]);
    }

    [Fact]
    public async Task Connect_Codex_relays_the_link_and_code_and_the_sign_in_s_status()
    {
        var started = await host.Host.PostJson(new { }, CodexLoginPath).Receive<CodexLoginStart>();
        var pending = await host.Host.GetAsJson<CodexLoginStatus>(CodexLoginPath);

        Codex.Connected = true;
        var done = await host.Host.GetAsJson<CodexLoginStatus>(CodexLoginPath);

        Assert.Equal(Codex.Start, started);
        Assert.Equal("pending", pending!.Status);
        Assert.Equal("done", done!.Status);
    }

    [Fact]
    public async Task Cancel_stops_the_pending_sign_in()
    {
        var cancelled = await host.Host.PostJson(new { }, $"{CodexLoginPath}/cancel").Receive<CodexLoginStatus>();

        Assert.Equal("none", cancelled!.Status);
        Assert.True(Codex.Cancelled);
    }

    [Fact]
    public async Task A_login_file_connects_Codex_and_Disconnect_removes_the_login()
    {
        var saved = await host.Host.PutJson(new SaveCodexLoginFileRequest("{\"tokens\":{}}"), $"{CodexLoginPath}-file").Receive<ProviderStatus>();
        var disconnected = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url(CodexLoginPath);
            scenario.StatusCodeShouldBeOk();
        });

        Assert.True(saved!.Connected);
        Assert.Equal("{\"tokens\":{}}", Codex.SavedLoginFile);
        Assert.Equal(CodexNotConnected, disconnected.ReadAsJson<ProviderStatus>());
    }

    [Fact]
    public async Task An_empty_login_file_is_refused_and_an_unreachable_runner_is_a_problem_not_a_crash()
    {
        var empty = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveCodexLoginFileRequest(" ")).ToUrl($"{CodexLoginPath}-file");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        Codex.Unreachable = true;
        var away = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new { }).ToUrl(CodexLoginPath);
            scenario.StatusCodeShouldBe(HttpStatusCode.ServiceUnavailable);
        });

        Assert.Contains("auth.json", await empty.ReadAsTextAsync());
        Assert.Contains("can't be reached", await away.ReadAsTextAsync());
    }

    private Task ResetAsync() => WithDbAsync(async db =>
    {
        Codex.Reset();
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
