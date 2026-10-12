using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;

namespace PowerLoom.AzureIntegration.Features.Resources;

public interface IAzureIdentityTester
{
    // Never throws: a runner that doesn't answer is an answer too.
    Task<AzureIdentityCheck> TestAsync(AzureIdentitySettings identity, CancellationToken cancellation);
}
