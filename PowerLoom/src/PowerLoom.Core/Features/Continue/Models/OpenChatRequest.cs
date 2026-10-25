namespace PowerLoom.Features.Continue.Models;

// `Id`: the PBI's ADO id, the item's id, the PR's id, or the vault's name. `Folder`: an import's source folder on the PC.
public sealed record OpenChatRequest(ChatKind Kind, string Id, string? Folder = null);
