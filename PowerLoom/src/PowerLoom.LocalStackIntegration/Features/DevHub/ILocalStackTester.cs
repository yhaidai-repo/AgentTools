using PowerLoom.LocalStackIntegration.Features.DevHub.Models;

namespace PowerLoom.LocalStackIntegration.Features.DevHub;

public interface ILocalStackTester
{
    // Never throws: a runner or DevHub that doesn't answer is an answer too.
    Task<LocalStackCheck> TestAsync(LocalStackTarget target, CancellationToken cancellation);
}
