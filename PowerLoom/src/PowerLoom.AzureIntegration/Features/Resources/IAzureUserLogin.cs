using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// The device-code sign-in with the user's own account, run by the agent-runner (it holds the token cache).
public interface IAzureUserLogin
{
    // A failure is a problem (the runner is down, Entra refused): the page shows it.
    Task<Outcome<AzureLoginStart>> StartAsync(string vault, CancellationToken cancellation);

    Task<Outcome<AzureLoginStatus>> StatusAsync(string flowId, CancellationToken cancellation);

    Task<Outcome<bool>> SignOutAsync(string vault, CancellationToken cancellation);
}
