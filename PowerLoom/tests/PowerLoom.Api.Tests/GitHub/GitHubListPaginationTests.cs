using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.Api.Tests.GitHub;

[Collection(PowerLoomCollection.Name)]
public sealed class GitHubListPaginationTests(PowerLoomHost host)
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Exactly_full_limit_requires_empty_lookahead(bool repositories)
    {
        using var handler = new FakeHandler(page => Answer(Body(page, page <= 20 ? 100 : 0, repositories)));
        using var http = new HttpClient(handler);
        Assert.Equal(2000, await CountAsync(new GitHubClient(http, "synthetic"), repositories));
        Assert.Equal(21, handler.Calls);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Actual_later_page_is_explicitly_incomplete(bool repositories)
    {
        using var handler = new FakeHandler(page => Answer(Body(page, page <= 20 ? 100 : 1, repositories)));
        using var http = new HttpClient(handler);
        var error = await Assert.ThrowsAsync<GitHubRequestException>(() => CountAsync(new GitHubClient(http, "synthetic"), repositories));
        Assert.Contains("incomplete", error.Message);
        Assert.Equal(21, handler.Calls);
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(false, 101)]
    [InlineData(true, 0)]
    [InlineData(true, 101)]
    public async Task Terminal_pages_return_complete_lists(bool repositories, int total)
    {
        using var handler = new FakeHandler(page => Answer(Body(page, Math.Clamp(total - (page - 1) * 100, 0, 100), repositories)));
        using var http = new HttpClient(handler);
        Assert.Equal(total, await CountAsync(new GitHubClient(http, "synthetic"), repositories));
        Assert.Equal(total == 0 ? 1 : 2, handler.Calls);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(21)]
    public async Task Later_request_failure_never_returns_partial_results(int failurePage)
    {
        using var handler = new FakeHandler(page => page == failurePage ? Answer("unavailable", HttpStatusCode.ServiceUnavailable) : Answer(Body(page, 100)));
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<GitHubRequestException>(() => CountAsync(new GitHubClient(http, "synthetic"), false));
        Assert.Equal(failurePage, handler.Calls);
    }

    [Fact]
    public async Task Cancellation_during_paging_does_not_return_partial_results()
    {
        using var cancellation = new CancellationTokenSource();
        using var handler = new FakeHandler(page =>
        {
            if (page == 2) cancellation.Cancel();
            return Answer(Body(page, 100));
        });
        using var http = new HttpClient(handler);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => new GitHubClient(http, "synthetic").ListOpenPullRequestsAsync("synthetic", "demo", cancellation.Token));
        Assert.Equal(2, handler.Calls);
    }

    [Fact]
    public async Task Incomplete_open_list_preserves_existing_review_in_database()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var vault = $"github-cap-{Guid.NewGuid():N}";
        var repo = new Repo { Id = $"{vault}:demo", Vault = vault, Kind = RepoKind.Github, AdoProject = "synthetic", Name = "demo", RemoteUrl = "https://github.com/synthetic/demo.git", DefaultBranch = "main" };
        db.Vaults.Add(new Vault { Name = vault, Features = "{}" });
        db.Repos.Add(repo);
        var pr = ReviewFixSeed.Pr(db, 9893217, vault);
        pr.Origin = PullRequestOrigin.Github;
        pr.RepoId = repo.Id;
        pr.Url = "https://github.com/synthetic/demo/pull/2001";
        await db.SaveChangesAsync();
        var syncedAt = pr.SyncedAt;
        using var handler = new FakeHandler(page => Answer(Body(page, page <= 20 ? 100 : 1)));
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<GitHubRequestException>(() => new GitHubPullRequestSync(db).RunAsync(vault,
            new GitHubSettings { Enabled = true, Login = "sam", Token = "synthetic" }, new GitHubClient(http, "synthetic"), CancellationToken.None));
        db.ChangeTracker.Clear();
        var preserved = await db.PullRequests.AsNoTracking().Include(row => row.CodeReview).SingleAsync(row => row.Id == pr.Id);
        Assert.True(preserved.IsListed);
        Assert.Equal(syncedAt, preserved.SyncedAt);
        Assert.NotNull(preserved.CodeReview);
        Assert.Equal(ReviewStatus.Active, preserved.CodeReview.Status);
        Assert.Single(await db.PullRequests.Where(row => row.Vault == vault).ToListAsync());
        Assert.Equal(21, handler.Calls);
    }

    private static async Task<int> CountAsync(GitHubClient client, bool repositories) => repositories
        ? (await client.ListRepositoriesAsync(CancellationToken.None)).Count
        : (await client.ListOpenPullRequestsAsync("synthetic", "demo", CancellationToken.None)).Count;

    private static string Body(int page, int count, bool repositories = false) => repositories
        ? JsonSerializer.Serialize(Enumerable.Range((page - 1) * 100 + 1, count).Select(number => new { name = $"repo-{number}", owner = new { login = "synthetic" }, clone_url = "https://example.invalid/repo.git", default_branch = "main", archived = false, disabled = false }))
        : JsonSerializer.Serialize(Enumerable.Range((page - 1) * 100 + 1, count).Select(number => new
        {
            number, title = $"PR {number}", user = new { login = "sam" }, head = new { @ref = "feature", sha = "head" },
            @base = new { @ref = "main", sha = "base" }, draft = false, created_at = "2026-10-26T00:00:00Z", html_url = $"https://github.com/synthetic/demo/pull/{number}"
        }));

    private static HttpResponseMessage Answer(string body, HttpStatusCode status = HttpStatusCode.OK) => new(status)
    {
        Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
    };

    private sealed class FakeHandler(Func<int, HttpResponseMessage> response) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (request.RequestUri!.AbsolutePath == "/search/issues")
                return Task.FromResult(Answer("{\"items\":[],\"total_count\":0,\"incomplete_results\":false}"));
            return Task.FromResult(response(++Calls));
        }
    }
}
