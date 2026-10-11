using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's port: answers busy as often as `BusyAnswers` says, then accepts; never calls back.
public sealed class FakeRunnerClient : IRunnerClient
{
    private readonly Lock _lock = new();

    public int BusyAnswers { get; set; }

    public List<RunnerRequest> Requests { get; } = [];

    public Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation)
    {
        lock (_lock)
        {
            Requests.Add(request);

            if (BusyAnswers > 0)
            {
                BusyAnswers -= 1;

                return Task.FromResult(RunnerAnswer.Busy);
            }

            return Task.FromResult(RunnerAnswer.Accepted);
        }
    }
}
