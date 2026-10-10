namespace PowerLoom.Features.Continue.Models;

// `Id`: the PBI's ADO id, the item's id, the PR's id, or the vault's name.
public sealed record OpenChatRequest(ChatKind Kind, string Id);
