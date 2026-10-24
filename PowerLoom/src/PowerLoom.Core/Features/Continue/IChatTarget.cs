using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;

namespace PowerLoom.Features.Continue;

// One kind of chat: what its note holds. Only "not found" and missing setup are problems (user decision 2026-10-10:
// no checks, the user starts the chat and judges it). Only a PBI's chat changes a status (user decision 2026-10-19).
public interface IChatTarget
{
    ChatKind Kind { get; }

    Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation);

    // What opening the chat changes, once its link is ready.
    Task OpenedAsync(string id, CancellationToken cancellation) => Task.CompletedTask;
}
