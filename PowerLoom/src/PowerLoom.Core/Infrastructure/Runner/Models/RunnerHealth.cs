namespace PowerLoom.Infrastructure.Runner.Models;

// The runner's `GET /health`: whether it answers and the task it is running, if any.
public sealed record RunnerHealth(bool Reachable, string? RunningTask, string? Detail);
