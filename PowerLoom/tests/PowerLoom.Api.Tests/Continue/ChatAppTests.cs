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
    public Task InitializeAsync() => ForgetChoiceAsync();

    // The other tests in the collection expect Claude, the .env default.
    public Task DisposeAsync() => ForgetChoiceAsync();

    [Fact]
    public async Task The_registered_apps_are_listed_and_Claude_is_chosen_until_another_is_saved()
    {
        var apps = await host.Host.GetAsJson<ChatApps>("/api/chats/apps");

        Assert.Equal(ClaudeDesktopLauncher.LauncherId, apps!.Current);
        Assert.Contains(new ChatApp(ClaudeDesktopLauncher.LauncherId, "Claude"), apps.Apps);
        Assert.Contains(new ChatApp(ProbeChatLauncher.LauncherId, "Probe App"), apps.Apps);
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
            scenario.Put.Json(new ChooseChatAppRequest("codex-desktop")).ToUrl("/api/chats/app");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
        var apps = await host.Host.GetAsJson<ChatApps>("/api/chats/apps");

        Assert.Contains("Unknown chat app \\\"codex-desktop\\\"", await refused.ReadAsTextAsync());
        Assert.Equal(ProbeChatLauncher.LauncherId, apps!.Current);
    }

    private async Task ForgetChoiceAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await GlobalSettings.DeleteAsync(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), ChatLaunchers.SettingKey, CancellationToken.None);
    }
}
