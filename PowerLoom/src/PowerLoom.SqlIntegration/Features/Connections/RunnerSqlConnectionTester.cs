using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.SqlIntegration.Features.Connections.Models;

namespace PowerLoom.SqlIntegration.Features.Connections;

// The test signs in through the agent-runner, with the SQL driver the agents use (user decision 2026-10-12): the backend
// has no SQL driver, since SqlClient refuses its invariant globalization.
public sealed class RunnerSqlConnectionTester(IHttpClientFactory clients, IOptions<RunnerOptions> options) : ISqlConnectionTester
{
    // The runner's own connect timeout is 10 s; this only guards against a runner that hangs.
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(40);

    public async Task<SqlConnectionCheck> TestAsync(string connectionString, CancellationToken cancellation)
    {
        try
        {
            return await AskRunnerAsync(connectionString, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return new SqlConnectionCheck(false, $"The agent-runner can't test the connection: {error.Message}");
        }
    }

    private async Task<SqlConnectionCheck> AskRunnerAsync(string connectionString, CancellationToken cancellation)
    {
        using var http = clients.CreateClient(RunnerClient.HttpClientName);
        http.Timeout = TestTimeout;

        using var response = await http.PostAsJsonAsync($"{options.Value.Url.TrimEnd('/')}/sql/test", new RunnerSqlTest(connectionString), cancellation);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<SqlConnectionCheck>(cancellation) ?? new SqlConnectionCheck(false, "The agent-runner answered without a result.");
    }
}
