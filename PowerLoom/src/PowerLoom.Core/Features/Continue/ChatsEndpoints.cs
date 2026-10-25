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
        var opened = await opener.OpenAsync(request, cancellation);

        return opened.Ok ? TypedResults.Ok(opened.Value) : opened.Problem.ToProblemResult();
    }

    // Every button's label and, when no chat can open, the reason; checking changes nothing.
    [WolverineGet("/api/chats/launcher")]
    public static async Task<LauncherAvailability> Launcher(ChatLaunchers launchers, CancellationToken cancellation)
    {
        var current = await launchers.CurrentAsync(cancellation);

        return new LauncherAvailability(await launchers.LabelAsync(cancellation), current.Ok ? null : current.Problem.Detail);
    }

    // Settings → AI providers: the apps a chat can open in, whether each is connected, and the chosen one.
    [WolverineGet("/api/chats/apps")]
    public static Task<ChatApps> Apps(ChatAppChoices choices, CancellationToken cancellation) => choices.AppsAsync(cancellation);

    [WolverinePut("/api/chats/app")]
    public static async Task<Results<Ok<ChatApps>, ProblemHttpResult>> ChooseApp(ChooseChatAppRequest request, ChatAppChoices choices, CancellationToken cancellation)
    {
        var chosen = await choices.ChooseAsync(request.Launcher, cancellation);

        return chosen.Ok ? TypedResults.Ok(chosen.Value) : chosen.Problem.ToProblemResult();
    }
}
