using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.DevHubIntegration.Features.DevHub;

public interface IDevHubTester
{
    // Never throws: a runner or DevHub that doesn't answer is an answer too.
    Task<DevHubCheck> TestAsync(DevHubTarget target, CancellationToken cancellation);
}
