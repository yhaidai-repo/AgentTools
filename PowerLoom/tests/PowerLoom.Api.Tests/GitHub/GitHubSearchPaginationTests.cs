using System.Net;
using System.Text.Json;
using PowerLoom.GitHubIntegration.Client;

namespace PowerLoom.Api.Tests.GitHub;

public sealed class GitHubSearchPaginationTests
{
    [Fact]
    public async Task Reviewed_search_reads_later_pages()
    {
        using var handler = new FakeHandler(page => Body(101, page == 1 ? Enumerable.Range(1, 100) : [101]));
        using var http = new HttpClient(handler);
        var result = await new GitHubClient(http, "synthetic").ListReviewedPullRequestsAsync("sam", CancellationToken.None);
        Assert.Equal(101, result.Count);
        Assert.Equal(2, handler.Calls);
        Assert.Contains(result, key => key.EndsWith("101", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(101, true)]
    [InlineData(1001, false)]
    [InlineData(101, false)]
    public async Task Incomplete_or_limited_search_fails_closed(int total, bool incomplete)
    {
        using var handler = new FakeHandler(_ => Body(total, [], incomplete));
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<GitHubRequestException>(() => new GitHubClient(http, "synthetic").ListReviewedPullRequestsAsync("sam", CancellationToken.None));
    }

    [Fact]
    public async Task Empty_search_is_complete_and_cancellation_stops_requests()
    {
        using var handler = new FakeHandler(_ => Body(0, []));
        using var http = new HttpClient(handler);
        var client = new GitHubClient(http, "synthetic");
        Assert.Empty(await client.ListReviewedPullRequestsAsync("sam", CancellationToken.None));
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.ListReviewedPullRequestsAsync("sam", cancelled.Token));
        Assert.Equal(1, handler.Calls);
    }

    [Theory]
    [InlineData("{\"items\":[]}")]
    [InlineData("{\"items\":[],\"total_count\":0}")]
    [InlineData("{\"total_count\":0,\"incomplete_results\":false}")]
    public async Task Missing_search_metadata_does_not_become_an_authoritative_empty_set(string body)
    {
        using var handler = new FakeHandler(_ => body);
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<GitHubRequestException>(() => new GitHubClient(http, "synthetic").ListReviewedPullRequestsAsync("sam", CancellationToken.None));
    }

    private static string Body(int total, IEnumerable<int> numbers, bool incomplete = false) => JsonSerializer.Serialize(new
    {
        total_count = total, incomplete_results = incomplete,
        items = numbers.Select(number => new { number, repository_url = "https://api.github.com/repos/synthetic/demo" })
    });

    private sealed class FakeHandler(Func<int, string> body) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body(++Calls), System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
