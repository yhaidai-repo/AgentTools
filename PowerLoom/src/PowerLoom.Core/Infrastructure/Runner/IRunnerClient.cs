using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Infrastructure.Runner;

public interface IRunnerClient
{
    Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation);

    // Stop on the run page: false when the task isn't the one running.
    Task<bool> StopAsync(string taskId, CancellationToken cancellation);

    // Never throws: an unreachable runner is an answer (the dashboard shows it).
    Task<RunnerHealth> HealthAsync(CancellationToken cancellation);
}
