using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Proxies the runner's `/azure/login/*`: the runner talks to Entra and keeps the token cache; the backend only relays.
public sealed class RunnerAzureUserLogin(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IAzureUserLogin
{
    private static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(40);

    public Task<Outcome<AzureLoginStart>> StartAsync(string vault, CancellationToken cancellation)
    {
        return CallAsync<AzureLoginStart>(http => http.PostAsJsonAsync($"{BaseUrl}/azure/login/start", new RunnerLoginStart(vault), cancellation), cancellation);
    }

    public Task<Outcome<AzureLoginStatus>> StatusAsync(string flowId, CancellationToken cancellation)
    {
        return CallAsync<AzureLoginStatus>(http => http.GetAsync($"{BaseUrl}/azure/login/status?flowId={Uri.EscapeDataString(flowId)}", cancellation), cancellation);
    }

    public async Task<Outcome<bool>> SignOutAsync(string vault, CancellationToken cancellation)
    {
        var result = await CallAsync<JsonElement>(http => http.DeleteAsync($"{BaseUrl}/azure/login?vault={Uri.EscapeDataString(vault)}", cancellation), cancellation);

        return result.Ok ? Outcome<bool>.Success(true) : Outcome<bool>.Failure(result.Problem);
    }

    private string BaseUrl => options.Value.Url.TrimEnd('/');

    private async Task<Outcome<T>> CallAsync<T>(Func<HttpClient, Task<HttpResponseMessage>> call, CancellationToken cancellation)
        where T : notnull
    {
        try
        {
            using var http = clients.CreateClient(RunnerClient.HttpClientName);
            http.Timeout = CallTimeout;

            using var response = await call(http);

            return await OutcomeOfAsync<T>(response, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Outcome<T>.Failure(new Problem(503, $"The agent-runner can't be reached: {error.Message}"));
        }
    }

    // The runner answers 4xx/5xx with {error}: that text is the problem.
    private static async Task<Outcome<T>> OutcomeOfAsync<T>(HttpResponseMessage response, CancellationToken cancellation)
        where T : notnull
    {
        if (response.IsSuccessStatusCode)
        {
            var value = await response.Content.ReadFromJsonAsync<T>(cancellation);

            return value is null ? Outcome<T>.Failure(new Problem(502, "The agent-runner answered without a result.")) : Outcome<T>.Success(value);
        }

        var body = await response.Content.ReadAsStringAsync(cancellation);

        return Outcome<T>.Failure(new Problem(502, ErrorOf(body, (int)response.StatusCode)));
    }

    private static string ErrorOf(string body, int status)
    {
        try
        {
            using var document = JsonDocument.Parse(body);

            return document.RootElement.TryGetProperty("error", out var error) ? error.GetString() ?? $"the runner answered {status}" : $"the runner answered {status}";
        }
        catch (JsonException)
        {
            return $"the runner answered {status}";
        }
    }
}
