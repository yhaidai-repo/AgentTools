using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace PowerLoom.Infrastructure.Runner;

// The agent-runner's /health. Degraded, not unhealthy, when it doesn't answer: PowerLoom runs without it (the runs wait
// for it), and the runner starts after PowerLoom is healthy, so an unhealthy answer here would stall the stack.
public sealed class RunnerHealthCheck(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IHealthCheck
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var http = clients.CreateClient(RunnerClient.HttpClientName);
            http.Timeout = Timeout;

            using var response = await http.GetAsync($"{options.Value.Url.TrimEnd('/')}/health", cancellationToken);

            return response.IsSuccessStatusCode ? HealthCheckResult.Healthy("the runner answers") : HealthCheckResult.Degraded($"the runner answered {(int)response.StatusCode}");
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            return HealthCheckResult.Degraded($"the runner doesn't answer: {error.Message}");
        }
    }
}
