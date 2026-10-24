using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Features.AiProviders;
using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.Api.Tests.AiProviders;

public sealed class RunnerHttpTests
{
    [Fact]
    public async Task A_stalled_runner_counts_as_not_connected_after_the_short_status_wait()
    {
        var codex = new CodexConnection(new RunnerCodexLogin(new RunnerHttp(new StalledRunner(), Options.Create(new RunnerOptions { Url = "http://runner" }))));
        var clock = Stopwatch.StartNew();

        var status = await codex.StatusAsync(CancellationToken.None);

        Assert.False(status.Connected);
        Assert.InRange(clock.Elapsed, RunnerHttp.StatusTimeout, RunnerHttp.StatusTimeout + TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task A_stalled_runner_is_a_503_problem()
    {
        var runner = new RunnerHttp(new StalledRunner(), Options.Create(new RunnerOptions { Url = "http://runner" }));

        var answer = await runner.GetAsync<JsonElement>("/codex/status", CancellationToken.None, TimeSpan.FromMilliseconds(200));

        Assert.False(answer.Ok);
        Assert.Equal(503, answer.Problem.Status);
    }

    // A runner that takes the request and never answers.
    private sealed class StalledRunner : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(new NeverAnswers());

        private sealed class NeverAnswers : HttpMessageHandler
        {
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);

                return new HttpResponseMessage();
            }
        }
    }
}
