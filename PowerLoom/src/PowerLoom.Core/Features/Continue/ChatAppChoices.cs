using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;

namespace PowerLoom.Features.Continue;

// Settings → AI providers → Chat app: only a connected app can be chosen (owner's decision 2026-10-24). Claude Desktop
// needs nothing from PowerLoom; Codex needs Connect Codex.
public sealed class ChatAppChoices(ChatLaunchers launchers, CodexConnection codex)
{
    public async Task<ChatApps> AppsAsync(CancellationToken cancellation)
    {
        var apps = new List<ChatApp>();

        foreach (var launcher in launchers.Registered)
            apps.Add(new ChatApp(launcher.Id, launcher.Label, await IsConnectedAsync(launcher, cancellation)));

        return new ChatApps(await launchers.ChosenIdAsync(cancellation), apps);
    }

    // Saving the app already chosen changes nothing, so it isn't refused when that app got disconnected since.
    public async Task<Outcome<ChatApps>> ChooseAsync(string id, CancellationToken cancellation)
    {
        var launcher = launchers.Registered.SingleOrDefault(candidate => candidate.Id == id);
        var unchanged = id == await launchers.ChosenIdAsync(cancellation);

        if (launcher is not null && !unchanged && !await IsConnectedAsync(launcher, cancellation))
            return Outcome<ChatApps>.Failure(Problem.Invalid($"Connect {launcher.Label} in Settings → AI providers before choosing it as the chat app."));

        var chosen = await launchers.ChooseAsync(id, cancellation);

        return chosen.Ok ? Outcome<ChatApps>.Success(await AppsAsync(cancellation)) : Outcome<ChatApps>.Failure(chosen.Problem);
    }

    private async Task<bool> IsConnectedAsync(IChatLauncher launcher, CancellationToken cancellation)
    {
        return launcher.Id != CodexDesktopLauncher.LauncherId || await codex.IsConnectedAsync(cancellation);
    }
}
