using PowerLoom.LocalStackIntegration.Features.DevHub;
using PowerLoom.LocalStackIntegration.Features.DevHub.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's `POST /local-stack/test`: remembers DevHub it was asked about.
public sealed class FakeLocalStackTester : ILocalStackTester
{
    public LocalStackTarget? LastTarget { get; private set; }

    public LocalStackCheck Answer { get; set; } = new(true, "DevHub answers and accepts the token: 18 services can run.");

    public Task<LocalStackCheck> TestAsync(LocalStackTarget target, CancellationToken cancellation)
    {
        LastTarget = target;

        return Task.FromResult(Answer);
    }
}
