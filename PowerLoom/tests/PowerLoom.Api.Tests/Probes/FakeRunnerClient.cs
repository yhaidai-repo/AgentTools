using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's port: answers busy as often as `BusyAnswers` says, then accepts; never calls back.
public sealed class FakeRunnerClient : IRunnerClient
{
    private readonly Lock _lock = new();

    public int BusyAnswers { get; set; }

    public List<RunnerRequest> Requests { get; } = [];

    // Unreachable unless a test says otherwise.
    public RunnerHealth Health { get; set; } = new(false, null, "no runner in the tests");

    // The task the runner says it runs, for Stop.
    public string? Running { get; set; }

    public List<string> Stops { get; } = [];

    public Task<RunnerHealth> HealthAsync(CancellationToken cancellation) => Task.FromResult(Health);

    public Task<bool> StopAsync(string taskId, CancellationToken cancellation)
    {
        lock (_lock)
        {
            Stops.Add(taskId);

            return Task.FromResult(Running == taskId);
        }
    }

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
