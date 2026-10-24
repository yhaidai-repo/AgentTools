using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Infrastructure.Runner;

public interface IRunnerClient
{
    Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation);

    // Never throws: an unreachable runner is an answer (the dashboard shows it).
    Task<RunnerHealth> HealthAsync(CancellationToken cancellation);
}
