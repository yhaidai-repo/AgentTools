using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.DevHubIntegration.Features.DevHub;

// The test calls DevHub from the agent-runner, the container the agents' calls come from: it proves the runner
// reaches host.docker.internal and that the token is right.
public sealed class RunnerDevHubTester(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IDevHubTester
{
    // A DevHub status call starts a script on the host; this only guards against a runner that hangs.
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(40);

    public async Task<DevHubCheck> TestAsync(DevHubTarget target, CancellationToken cancellation)
    {
        try
        {
            return await AskRunnerAsync(target, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return new DevHubCheck(false, $"The agent-runner can't test DevHub: {error.Message}");
        }
    }

    private async Task<DevHubCheck> AskRunnerAsync(DevHubTarget target, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(RunnerClient.HttpClientName);
        http.Timeout = TestTimeout;

        using var response = await http.PostAsJsonAsync($"{options.Value.Url.TrimEnd('/')}/devhub/test", target, cancellation);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<DevHubCheck>(cancellation) ?? new DevHubCheck(false, "The agent-runner answered without a result.");
    }
}
