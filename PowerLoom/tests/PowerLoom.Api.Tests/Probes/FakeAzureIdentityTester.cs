using PowerLoom.AzureIntegration.Features.Resources;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's `POST /azure/test`: remembers the identity it was asked about.
public sealed class FakeAzureIdentityTester : IAzureIdentityTester
{
    public AzureIdentitySettings? LastIdentity { get; private set; }

    public AzureIdentityCheck Answer { get; set; } = new(true, "Signed in: tenant contoso.onmicrosoft.com, token for management.azure.com.");

    public Task<AzureIdentityCheck> TestAsync(AzureIdentitySettings identity, CancellationToken cancellation)
    {
        LastIdentity = identity;

        return Task.FromResult(Answer);
    }
}
