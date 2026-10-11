using PowerLoom.Persistence.Enums;
using Wolverine.Persistence.Sagas;

namespace PowerLoom.Features.Agents.AgentRun;

// The runner's one callback: the run ended (it ended the task itself: done, open again, blocked).
public sealed record AgentRunCompleted([property: SagaIdentity] string TaskId, long? RunId, RunOutcome Outcome, string? Error);
