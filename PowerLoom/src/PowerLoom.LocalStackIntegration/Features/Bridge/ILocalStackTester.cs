using PowerLoom.LocalStackIntegration.Features.Bridge.Models;

namespace PowerLoom.LocalStackIntegration.Features.Bridge;

public interface ILocalStackTester
{
    // Never throws: a runner or bridge that doesn't answer is an answer too.
    Task<LocalStackCheck> TestAsync(LocalStackTarget target, CancellationToken cancellation);
}
