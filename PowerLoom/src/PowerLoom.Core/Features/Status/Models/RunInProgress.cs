namespace PowerLoom.Features.Status.Models;

// A claimed agent task: stuck when it has been in progress longer than its agent's timeout plus the runner margin,
// i.e. the run saga should have given it up by now.
public sealed record RunInProgress(string TaskId, string AgentId, int? PbiId, DateTimeOffset Since, bool Stuck);
