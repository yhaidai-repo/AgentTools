namespace PowerLoom.Domain.Tasks.Models;

// A person closing a question, finding or human task; `HasAttachment` when files came with the answer.
public sealed record CloseItemRequest(string ItemId, int? AdoId, CloseDecision Decision, string? Resolution, bool HasAttachment);
