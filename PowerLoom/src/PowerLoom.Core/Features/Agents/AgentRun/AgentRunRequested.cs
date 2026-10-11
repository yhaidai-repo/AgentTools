using Wolverine.Persistence.Sagas;

namespace PowerLoom.Features.Agents.AgentRun;

// A claimed task for the runner: starts its AgentRun saga.
public sealed record AgentRunRequested([property: SagaIdentity] string TaskId, string AgentId, int? PbiId, string Vault, int TimeoutMinutes);
