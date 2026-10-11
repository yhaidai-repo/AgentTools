using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Infrastructure.Runner;

// A singleton over the named client: Wolverine's generated handlers refuse a typed HttpClient (a transient factory).
public sealed class RunnerClient(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IRunnerClient
{
    public const string HttpClientName = "runner";

    private static readonly TimeSpan HealthTimeout = TimeSpan.FromSeconds(5);

    public async Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(HttpClientName);
        using var response = await http.PostAsJsonAsync($"{BaseUrl}/runs", request, cancellation);

        if (response.StatusCode == HttpStatusCode.Conflict)
            return RunnerAnswer.Busy;

        response.EnsureSuccessStatusCode();

        return RunnerAnswer.Accepted;
    }

    public async Task<RunnerHealth> HealthAsync(CancellationToken cancellation)
    {
        try
        {
            using var http = clients.CreateClient(HttpClientName);
            http.Timeout = HealthTimeout;

            using var response = await http.GetAsync($"{BaseUrl}/health", cancellation);

            if (!response.IsSuccessStatusCode)
                return new RunnerHealth(false, null, $"the runner answered {(int)response.StatusCode}");

            return new RunnerHealth(true, RunningTaskOf(await response.Content.ReadAsStringAsync(cancellation)), null);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            return new RunnerHealth(false, null, error.Message);
        }
    }

    private string BaseUrl => options.Value.Url.TrimEnd('/');

    private static string? RunningTaskOf(string body)
    {
        using var document = JsonDocument.Parse(body);

        return document.RootElement.TryGetProperty("running", out var running) && running.ValueKind == JsonValueKind.String ? running.GetString() : null;
    }
}
