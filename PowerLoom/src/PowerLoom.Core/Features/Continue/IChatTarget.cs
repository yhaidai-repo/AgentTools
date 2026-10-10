using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;

namespace PowerLoom.Features.Continue;

// One kind of chat: what its note holds. Only "not found" and missing setup are problems (user decision 2026-10-10:
// no checks and no status changes, the user starts the chat and judges it).
public interface IChatTarget
{
    ChatKind Kind { get; }

    Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation);
}
