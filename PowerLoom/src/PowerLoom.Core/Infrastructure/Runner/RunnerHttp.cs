using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;

namespace PowerLoom.Infrastructure.Runner;

// Calls to the agent-runner's own routes (sign-ins, logins), answered as outcomes: the runner answers 4xx/5xx with
// {error}, and that text is the problem the page shows; an unreachable runner is a 503.
public sealed class RunnerHttp(IHttpClientFactory clients, IOptions<RunnerOptions> options)
{
    private static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(40);

    public Task<Outcome<T>> GetAsync<T>(string path, CancellationToken cancellation)
        where T : notnull
    {
        return CallAsync<T>(http => http.GetAsync(UrlOf(path), cancellation), cancellation);
    }

    public Task<Outcome<T>> PostAsync<T>(string path, object body, CancellationToken cancellation)
        where T : notnull
    {
        return CallAsync<T>(http => http.PostAsJsonAsync(UrlOf(path), body, cancellation), cancellation);
    }

    public Task<Outcome<T>> PutAsync<T>(string path, object body, CancellationToken cancellation)
        where T : notnull
    {
        return CallAsync<T>(http => http.PutAsJsonAsync(UrlOf(path), body, cancellation), cancellation);
    }

    public Task<Outcome<T>> DeleteAsync<T>(string path, CancellationToken cancellation)
        where T : notnull
    {
        return CallAsync<T>(http => http.DeleteAsync(UrlOf(path), cancellation), cancellation);
    }

    private string UrlOf(string path) => $"{options.Value.Url.TrimEnd('/')}{path}";

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
