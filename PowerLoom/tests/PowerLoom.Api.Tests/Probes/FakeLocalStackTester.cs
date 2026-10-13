using PowerLoom.LocalStackIntegration.Features.Bridge;
using PowerLoom.LocalStackIntegration.Features.Bridge.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's `POST /local-stack/test`: remembers the bridge it was asked about.
public sealed class FakeLocalStackTester : ILocalStackTester
{
    public LocalStackTarget? LastTarget { get; private set; }

    public LocalStackCheck Answer { get; set; } = new(true, "The bridge answers and accepts the token: 18 services can run.");

    public Task<LocalStackCheck> TestAsync(LocalStackTarget target, CancellationToken cancellation)
    {
        LastTarget = target;

        return Task.FromResult(Answer);
    }
}
