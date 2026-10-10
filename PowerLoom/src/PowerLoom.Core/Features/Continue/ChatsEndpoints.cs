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
    public static LauncherAvailability Launcher(ChatLaunchers launchers)
    {
        var current = launchers.Current();

        return new LauncherAvailability(launchers.Label(), current.Ok ? null : current.Problem.Detail);
    }
}
