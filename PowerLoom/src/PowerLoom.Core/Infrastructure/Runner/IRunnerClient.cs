using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Infrastructure.Runner;

public interface IRunnerClient
{
    Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation);
}
