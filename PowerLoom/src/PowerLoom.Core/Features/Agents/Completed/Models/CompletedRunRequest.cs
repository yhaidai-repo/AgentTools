using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Agents.Completed.Models;

// The runner's callback body: the run row it ended, its outcome, and the error when there was one.
public sealed record CompletedRunRequest(long? RunId, RunOutcome Outcome, string? Error);
