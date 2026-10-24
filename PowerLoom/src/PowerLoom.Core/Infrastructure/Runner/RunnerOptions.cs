namespace PowerLoom.Infrastructure.Runner;

// The agent-runner's HTTP port (inside the compose network, unauthenticated like web ↔ PowerLoom).
public sealed class RunnerOptions
{
    public const string Section = "Runner";

    public string Url { get; set; } = "http://agent-runner:3200";

    // The runner runs one task at a time: a 409 is retried after this.
    public TimeSpan BusyRetry { get; set; } = TimeSpan.FromSeconds(30);

    // On top of the agent's timeoutMinutes before a run without a callback is given up (the runner died).
    public TimeSpan TimeoutMargin { get; set; } = TimeSpan.FromMinutes(10);
}
