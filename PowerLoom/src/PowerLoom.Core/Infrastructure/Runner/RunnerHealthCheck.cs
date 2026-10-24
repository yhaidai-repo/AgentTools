using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace PowerLoom.Infrastructure.Runner;

// The agent-runner's /health. Degraded, not unhealthy, when it doesn't answer: PowerLoom runs without it (the runs wait
// for it), and the runner starts after PowerLoom is healthy, so an unhealthy answer here would stall the stack.
public sealed class RunnerHealthCheck(IRunnerClient runner) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var health = await runner.HealthAsync(cancellationToken);

        return health.Reachable ? HealthCheckResult.Healthy("the runner answers") : HealthCheckResult.Degraded($"the runner doesn't answer: {health.Detail}");
    }
}
