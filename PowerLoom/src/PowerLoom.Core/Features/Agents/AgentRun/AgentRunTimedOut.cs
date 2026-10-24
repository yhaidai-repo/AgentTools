using Wolverine.Persistence.Sagas;

namespace PowerLoom.Features.Agents.AgentRun;

// No callback within the agent's timeout plus the margin: the runner died. `Attempt` tells a stale timeout (the task
// was released and claimed again) from the current one.
public sealed record AgentRunTimedOut([property: SagaIdentity] string TaskId, Guid Attempt);
