namespace PowerLoom.Features.Agents.Dispatch;

// The agent's schedule or "Run now": its open tasks go through the validator and the valid ones to the runner.
public sealed record DispatchAgent(string AgentId);
