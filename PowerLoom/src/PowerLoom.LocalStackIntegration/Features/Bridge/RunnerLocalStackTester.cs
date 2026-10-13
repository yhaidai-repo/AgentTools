using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.LocalStackIntegration.Features.Bridge.Models;

namespace PowerLoom.LocalStackIntegration.Features.Bridge;

// The test calls the bridge from the agent-runner, the container the agents' calls come from: it proves the runner
// reaches host.docker.internal and that the token is right.
public sealed class RunnerLocalStackTester(IHttpClientFactory clients, IOptions<RunnerOptions> options) : ILocalStackTester
{
    // A bridge status call starts a script on the host; this only guards against a runner that hangs.
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(40);

    public async Task<LocalStackCheck> TestAsync(LocalStackTarget target, CancellationToken cancellation)
    {
        try
        {
            return await AskRunnerAsync(target, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return new LocalStackCheck(false, $"The agent-runner can't test the bridge: {error.Message}");
        }
    }

    private async Task<LocalStackCheck> AskRunnerAsync(LocalStackTarget target, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(RunnerClient.HttpClientName);
        http.Timeout = TestTimeout;

        using var response = await http.PostAsJsonAsync($"{options.Value.Url.TrimEnd('/')}/local-stack/test", target, cancellation);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<LocalStackCheck>(cancellation) ?? new LocalStackCheck(false, "The agent-runner answered without a result.");
    }
}
