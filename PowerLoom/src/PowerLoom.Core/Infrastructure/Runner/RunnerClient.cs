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

    public async Task<bool> StopAsync(string taskId, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(HttpClientName);
        using var response = await http.PostAsJsonAsync($"{BaseUrl}/runs/stop", new { taskId }, cancellation);

        if (response.StatusCode == HttpStatusCode.Conflict)
            return false;

        response.EnsureSuccessStatusCode();

        return true;
    }

    public async Task<RunnerHealth> HealthAsync(CancellationToken cancellation)
    {
        try
        {
            using var http = clients.CreateClient(HttpClientName);
            http.Timeout = HealthTimeout;

            using var response = await http.GetAsync($"{BaseUrl}/health", cancellation);

            if (!response.IsSuccessStatusCode)
                return RunnerHealth.Unreachable($"the runner answered {(int)response.StatusCode}");

            return HealthOf(await response.Content.ReadAsStringAsync(cancellation));
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            return RunnerHealth.Unreachable(error.Message);
        }
    }

    private string BaseUrl => options.Value.Url.TrimEnd('/');

    // `runningTasks` and `maxParallelRuns` from a runner with slots; `running` alone from an older one (one slot).
    public static RunnerHealth HealthOf(string body)
    {
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        return new RunnerHealth(true, RunningTasksOf(root), MaxParallelRunsOf(root), null);
    }

    private static List<string> RunningTasksOf(JsonElement root)
    {
        if (root.TryGetProperty("runningTasks", out var list) && list.ValueKind == JsonValueKind.Array)
            return list.EnumerateArray().Where(task => task.ValueKind == JsonValueKind.String).Select(task => task.GetString()!).ToList();

        return root.TryGetProperty("running", out var running) && running.ValueKind == JsonValueKind.String ? [running.GetString()!] : [];
    }

    private static int? MaxParallelRunsOf(JsonElement root)
    {
        return root.TryGetProperty("maxParallelRuns", out var slots) && slots.ValueKind == JsonValueKind.Number && slots.TryGetInt32(out var max) ? max : null;
    }
}
