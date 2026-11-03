namespace PowerLoom.Infrastructure.Runner.Models;

// The runner's `GET /health`: whether it answers, the tasks it is running and how many it may run at once
// (RUNNER_MAX_PARALLEL_RUNS; null from a runner that doesn't say). `RunningTask` is the first of them, for the places
// that show one.
public sealed record RunnerHealth(bool Reachable, IReadOnlyList<string> RunningTasks, int? MaxParallelRuns, string? Detail)
{
    public static RunnerHealth Unreachable(string detail) => new(false, [], null, detail);

    public string? RunningTask => RunningTasks.Count > 0 ? RunningTasks[0] : null;

    // How many more tasks the runner takes now; null when it doesn't say (then nothing caps the dispatch).
    public int? FreeSlots => MaxParallelRuns is int max ? Math.Max(0, max - RunningTasks.Count) : null;
}
