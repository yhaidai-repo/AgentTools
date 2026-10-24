using System.Text.Json;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Proxies the runner's `/azure/login/*`: the runner talks to Entra and keeps the token cache; the backend only relays.
public sealed class RunnerAzureUserLogin(RunnerHttp runner) : IAzureUserLogin
{
    public Task<Outcome<AzureLoginStart>> StartAsync(string vault, CancellationToken cancellation)
    {
        return runner.PostAsync<AzureLoginStart>("/azure/login/start", new RunnerLoginStart(vault), cancellation);
    }

    public Task<Outcome<AzureLoginStatus>> StatusAsync(string flowId, CancellationToken cancellation)
    {
        return runner.GetAsync<AzureLoginStatus>($"/azure/login/status?flowId={Uri.EscapeDataString(flowId)}", cancellation);
    }

    public async Task<Outcome<bool>> SignOutAsync(string vault, CancellationToken cancellation)
    {
        var result = await runner.DeleteAsync<JsonElement>($"/azure/login?vault={Uri.EscapeDataString(vault)}", cancellation);

        return result.Ok ? Outcome<bool>.Success(true) : Outcome<bool>.Failure(result.Problem);
    }
}
