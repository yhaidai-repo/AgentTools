namespace PowerLoom.Infrastructure.Runner.Models;

// `POST {runner}/runs`: the task the runner should run next.
public sealed record RunnerRequest(string TaskId, string AgentId, int? PbiId);
