using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.AzureIntegration.Features.Resources;

// The test signs in through the agent-runner, with the Azure SDK the agents use (as Read SQL does): the backend holds
// no Azure SDK.
public sealed class RunnerAzureIdentityTester(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IAzureIdentityTester
{
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(40);

    public async Task<AzureIdentityCheck> TestAsync(AzureIdentitySettings identity, CancellationToken cancellation)
    {
        try
        {
            return await AskRunnerAsync(identity, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new AzureIdentityCheck(false, $"The agent-runner can't test the identity: {error.Message}");
        }
    }

    private async Task<AzureIdentityCheck> AskRunnerAsync(AzureIdentitySettings identity, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(RunnerClient.HttpClientName);
        http.Timeout = TestTimeout;

        using var response = await http.PostAsJsonAsync($"{options.Value.Url.TrimEnd('/')}/azure/test", new RunnerIdentityTest(identity.TenantId, identity.ClientId, identity.ClientSecret), cancellation);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<AzureIdentityCheck>(cancellation) ?? new AzureIdentityCheck(false, "The agent-runner answered without a result.");
    }
}
