using PowerLoom.DevHubIntegration.Features.DevHub;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's `POST /devhub/test`: remembers DevHub it was asked about.
public sealed class FakeDevHubTester : IDevHubTester
{
    public DevHubTarget? LastTarget { get; private set; }

    public DevHubCheck Answer { get; set; } = new(true, "DevHub answers and accepts the token: 18 services can run.");

    public Task<DevHubCheck> TestAsync(DevHubTarget target, CancellationToken cancellation)
    {
        LastTarget = target;

        return Task.FromResult(Answer);
    }
}
