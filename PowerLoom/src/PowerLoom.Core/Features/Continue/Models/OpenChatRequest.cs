using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Features.Continue.Models;

// `Id`: the PBI's ADO id, the item's id, the PR's id, or the vault's name. `Folder`: an import's source folder on the PC.
// `Handoff`: the item's hand-offs as markdown, rendered by core's hand-off renderer so the chat reads what its agent reads.
public sealed record OpenChatRequest(ChatKind Kind, string Id, string? Folder = null, ChatDestination? Destination = null, string? Handoff = null);
