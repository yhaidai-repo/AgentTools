using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.Continue;

public static class ChatsEndpoints
{
    // "Continue with <agent>": the note is written, the link comes back, the browser opens it in the agent app.
    [WolverinePost("/api/chats")]
    public static async Task<Results<Ok<ChatLink>, ProblemHttpResult>> Post(OpenChatRequest request, ChatOpener opener, CancellationToken cancellation)
    {
        var opened = await opener.OpenAsync(request.Kind, request.Id, cancellation);

        return opened.Ok ? TypedResults.Ok(opened.Value) : opened.Problem.ToProblemResult();
    }

    // Every button's label and, when no chat can open, the reason; checking changes nothing.
    [WolverineGet("/api/chats/launcher")]
    public static async Task<LauncherAvailability> Launcher(ChatLaunchers launchers, CancellationToken cancellation)
    {
        var current = await launchers.CurrentAsync(cancellation);

        return new LauncherAvailability(await launchers.LabelAsync(cancellation), current.Ok ? null : current.Problem.Detail);
    }

    // Settings → AI providers: the apps a chat can open in, and the chosen one.
    [WolverineGet("/api/chats/apps")]
    public static Task<ChatApps> Apps(ChatLaunchers launchers, CancellationToken cancellation) => AppsOf(launchers, cancellation);

    [WolverinePut("/api/chats/app")]
    public static async Task<Results<Ok<ChatApps>, ProblemHttpResult>> ChooseApp(ChooseChatAppRequest request, ChatLaunchers launchers, CancellationToken cancellation)
    {
        var chosen = await launchers.ChooseAsync(request.Launcher, cancellation);

        return chosen.Ok ? TypedResults.Ok(await AppsOf(launchers, cancellation)) : chosen.Problem.ToProblemResult();
    }

    private static async Task<ChatApps> AppsOf(ChatLaunchers launchers, CancellationToken cancellation)
    {
        var apps = launchers.Registered.Select(launcher => new ChatApp(launcher.Id, launcher.Label)).ToList();

        return new ChatApps(await launchers.ChosenIdAsync(cancellation), apps);
    }
}
