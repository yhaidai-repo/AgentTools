using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Runner.Models;

namespace PowerLoom.Infrastructure.Runner;

// A singleton over the named client: Wolverine's generated handlers refuse a typed HttpClient (a transient factory).
public sealed class RunnerClient(IHttpClientFactory clients, IOptions<RunnerOptions> options) : IRunnerClient
{
    public const string HttpClientName = "runner";

    public async Task<RunnerAnswer> StartAsync(RunnerRequest request, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(HttpClientName);
        using var response = await http.PostAsJsonAsync($"{options.Value.Url.TrimEnd('/')}/runs", request, cancellation);

        if (response.StatusCode == HttpStatusCode.Conflict)
            return RunnerAnswer.Busy;

        response.EnsureSuccessStatusCode();

        return RunnerAnswer.Accepted;
    }
}
