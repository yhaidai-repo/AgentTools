namespace PowerLoom.Features.Status.Models;

// The agent-runner as the dashboard shows it: the tasks it runs (`RunningTask` the first of them) and its slots
// (RUNNER_MAX_PARALLEL_RUNS; null from a runner that doesn't say).
public sealed record RunnerStatus(StateLevel State, bool Reachable, string? RunningTask, IReadOnlyList<string> RunningTasks, int? MaxParallelRuns, string Url, string? Detail);
