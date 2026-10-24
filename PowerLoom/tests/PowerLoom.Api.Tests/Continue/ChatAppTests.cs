using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class ChatAppTests(PowerLoomHost host) : IAsyncLifetime
{
    public Task InitializeAsync() => ResetAsync();

    // The other tests in the collection expect Claude, the .env default.
    public Task DisposeAsync() => ResetAsync();

    [Fact]
    public async Task The_registered_apps_are_listed_and_Claude_is_chosen_until_another_is_saved()
    {
        var apps = await host.Host.GetAsJson<ChatApps>("/api/chats/apps");

        Assert.Equal(ClaudeDesktopLauncher.LauncherId, apps!.Current);
        Assert.Contains(new ChatApp(ClaudeDesktopLauncher.LauncherId, "Claude", true), apps.Apps);
        Assert.Contains(new ChatApp(CodexDesktopLauncher.LauncherId, "Codex", false), apps.Apps);
        Assert.Contains(new ChatApp(ProbeChatLauncher.LauncherId, "Probe App", true), apps.Apps);
    }

    [Fact]
    public async Task The_chosen_app_names_the_buttons_and_opens_the_chats()
    {
        var saved = await host.Host.PutJson(new ChooseChatAppRequest(ProbeChatLauncher.LauncherId), "/api/chats/app").Receive<ChatApps>();

        var launcher = await host.Host.GetAsJson<LauncherAvailability>("/api/chats/launcher");
        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Vault, PowerLoomHost.Vault), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "vault-test-vault.md"));

        Assert.Equal(ProbeChatLauncher.LauncherId, saved!.Current);
        Assert.Equal(new LauncherAvailability("Probe App", null), launcher);
        Assert.StartsWith("probe://chat?folder=", link!.Url);
        Assert.Contains("# Configure the vault test-vault for Probe App", note);
        Assert.Contains("Set up", note);
    }

    [Fact]
    public async Task An_unknown_app_is_refused_and_the_choice_stays()
    {
        await host.Host.PutJson(new ChooseChatAppRequest(ProbeChatLauncher.LauncherId), "/api/chats/app").Receive<ChatApps>();

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new ChooseChatAppRequest("no-such-app")).ToUrl("/api/chats/app");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
        var apps = await host.Host.GetAsJson<ChatApps>("/api/chats/apps");

        Assert.Contains("Unknown chat app \\\"no-such-app\\\"", await refused.ReadAsTextAsync());
        Assert.Equal(ProbeChatLauncher.LauncherId, apps!.Current);
    }

    [Fact]
    public async Task Codex_can_be_chosen_only_once_it_is_connected_and_then_opens_the_chats()
    {
        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new ChooseChatAppRequest(CodexDesktopLauncher.LauncherId)).ToUrl("/api/chats/app");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        host.Host.Services.GetRequiredService<FakeCodexLogin>().Connected = true;

        var saved = await host.Host.PutJson(new ChooseChatAppRequest(CodexDesktopLauncher.LauncherId), "/api/chats/app").Receive<ChatApps>();
        var launcher = await host.Host.GetAsJson<LauncherAvailability>("/api/chats/launcher");
        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Vault, PowerLoomHost.Vault), "/api/chats").Receive<ChatLink>();

        Assert.Contains("Connect Codex in Settings → AI providers", await refused.ReadAsTextAsync());
        Assert.Equal(CodexDesktopLauncher.LauncherId, saved!.Current);
        Assert.Contains(new ChatApp(CodexDesktopLauncher.LauncherId, "Codex", true), saved.Apps);
        Assert.Equal(new LauncherAvailability("Codex", null), launcher);
        Assert.StartsWith("codex://new?path=", link!.Url);
    }

    private async Task ResetAsync()
    {
        host.Host.Services.GetRequiredService<FakeCodexLogin>().Reset();
        await ForgetChoiceAsync();
    }

    private async Task ForgetChoiceAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await GlobalSettings.DeleteAsync(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), ChatLaunchers.SettingKey, CancellationToken.None);
    }
}
