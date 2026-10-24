using Wolverine.Persistence.Sagas;

namespace PowerLoom.Features.Agents.AgentRun;

// Ask the runner to run the task now; sent again after a delay while the runner is busy.
public sealed record StartAgentRun([property: SagaIdentity] string TaskId);
