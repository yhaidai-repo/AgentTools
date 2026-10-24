using PowerLoom.AzureIntegration.Features.Resources;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.Contracts;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the runner's device-code flow: one pending flow that the test finishes.
public sealed class FakeAzureUserLogin : IAzureUserLogin
{
    public string? StartedVault { get; private set; }

    public string? SignedOutVault { get; private set; }

    public AzureLoginStatus Status { get; set; } = new("pending", null, null);

    public Task<Outcome<AzureLoginStart>> StartAsync(string vault, CancellationToken cancellation)
    {
        StartedVault = vault;

        return Task.FromResult(Outcome<AzureLoginStart>.Success(new AzureLoginStart("flow-1", "ABCD-1234", "https://microsoft.com/devicelogin", "To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code ABCD-1234 to authenticate.", 900)));
    }

    public Task<Outcome<AzureLoginStatus>> StatusAsync(string flowId, CancellationToken cancellation)
    {
        return Task.FromResult(flowId == "flow-1" ? Outcome<AzureLoginStatus>.Success(Status) : Outcome<AzureLoginStatus>.Failure(new Problem(502, "Unknown or expired sign-in; start again.")));
    }

    public Task<Outcome<bool>> SignOutAsync(string vault, CancellationToken cancellation)
    {
        SignedOutVault = vault;

        return Task.FromResult(Outcome<bool>.Success(true));
    }
}
