using PowerLoom.Domain.Tasks.Models;

namespace PowerLoom.Features.Tasks.CloseItem.Models;

// The person's answer (question, finding) or outcome (human task). `DryRun` only checks whether the item can be closed
// this way: the web asks before it stores the uploads, so a refused request leaves none behind.
public sealed record CloseRequest(int? AdoId, CloseDecision Decision, string? Resolution, bool HasAttachment, bool DryRun = false);
