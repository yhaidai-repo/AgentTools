namespace PowerLoom.Infrastructure.Runner;

// The agent-runner's HTTP port (inside the compose network, unauthenticated like web ↔ PowerLoom).
public sealed class RunnerOptions
{
    public const string Section = "Runner";

    public string Url { get; set; } = "http://agent-runner:3200";

    // The runner runs up to its RUNNER_MAX_PARALLEL_RUNS tasks at once (default 1): a 409 (every slot busy) is retried
    // after this. The dispatch reads the free slots from the runner's /health first, so the retry is the backstop.
    public TimeSpan BusyRetry { get; set; } = TimeSpan.FromSeconds(30);

    // On top of the agent's timeoutMinutes before a run without a callback is given up (the runner died).
    public TimeSpan TimeoutMargin { get; set; } = TimeSpan.FromMinutes(10);
}
