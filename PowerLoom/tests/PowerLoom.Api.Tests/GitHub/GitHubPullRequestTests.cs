using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.GitHubIntegration.Client.Models;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.GitHub;

// Reviews from GitHub (user decision 2026-10-25): the PRs you wrote, are asked to review or reviewed, of enabled repos.
[Collection(PowerLoomCollection.Name)]
public sealed class GitHubPullRequestTests(PowerLoomHost host)
{
    private const string Owner = "prs";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private FakeGitHubClient GitHub => host.Host.Services.GetRequiredService<FakeGitHubClientFactory>().Client;

    [Fact]
    public async Task Your_pull_requests_become_reviews_follow_their_pushes_and_close_when_they_leave_the_list()
    {
        const string Repo = "prs-pushes";
        await SeedAsync(Repo);
        GitHub.Reviewed = [$"{Owner}/{Repo}#3"];
        GitHub.Pulls[$"{Owner}/{Repo}"] = [Pr(Repo, 1, "sam", [], "h1"), Pr(Repo, 2, "kim", ["sam"], "h2"), Pr(Repo, 3, "kim", [], "h3"), Pr(Repo, 4, "kim", [], "h4"), Pr(Repo, 5, "sam", [], "h5", draft: true)];

        await SyncAsync();
        var first = await RowsAsync(Repo);
        GitHub.Pulls[$"{Owner}/{Repo}"] = [Pr(Repo, 1, "sam", [], "h1-new"), Pr(Repo, 2, "kim", ["sam"], "h2")];
        await SyncAsync();
        var second = await RowsAsync(Repo);

        Assert.Equal(["/1", "/2", "/3", "/5"], first.Select(row => row.Url[row.Url.LastIndexOf('/')..]).Order());
        Assert.Equal(("refs/pull/1/head", "refs/heads/main", "h1", 1, PullRequestOrigin.Github), (first[0].SourceRef, first[0].TargetRef, first[0].SourceCommit, first[0].Iteration, first[0].Origin));
        Assert.Null(first.Single(row => row.Url.EndsWith("/5")).CodeReview);
        Assert.Equal(("h1-new", 2), (second[0].SourceCommit, second[0].Iteration));
        Assert.Equal((false, ReviewStatus.Closed), (second.Single(row => row.Url.EndsWith("/3")).IsListed, second.Single(row => row.Url.EndsWith("/3")).CodeReview!.Status));
    }

    [Fact]
    public async Task A_deleted_review_stays_deleted_and_the_Azure_DevOps_check_leaves_GitHub_reviews_alone()
    {
        const string Repo = "prs-deleted";
        await SeedAsync(Repo);
        GitHub.Pulls[$"{Owner}/{Repo}"] = [Pr(Repo, 11, "sam", [], "h11"), Pr(Repo, 12, "sam", [], "h12")];
        await SyncAsync();
        var deletedId = (await RowsAsync(Repo)).Single(row => row.Url.EndsWith("/11")).Id;

        await host.Host.Scenario(scenario => scenario.Delete.Json(new ReviewIds([deletedId])).ToUrl("/api/reviews"));
        await SyncAsync();
        await SaveAdoSettingsAsync();
        host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client.PullRequests = [];
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncPullRequests(PowerLoomHost.Vault)).AsTask());
        var rows = await RowsAsync(Repo);

        Assert.False(rows.Single(row => row.Id == deletedId).IsListed);
        Assert.Null(rows.Single(row => row.Id == deletedId).CodeReview);
        Assert.True(rows.Single(row => row.Url.EndsWith("/12")).IsListed);
    }

    [Fact]
    public async Task The_review_chat_fetches_the_pull_request_s_head_from_GitHub()
    {
        const string Repo = "prs-chat";
        await SeedAsync(Repo);
        GitHub.Pulls[$"{Owner}/{Repo}"] = [Pr(Repo, 21, "sam", [], "h21")];
        await SyncAsync();
        var id = (await RowsAsync(Repo)).Single(row => row.Url.EndsWith("/21")).Id;

        await host.Host.PostJson(new OpenChatRequest(ChatKind.Review, id.ToString()), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", $"review-{id}.md"));

        Assert.True(note.Contains("`git fetch origin main +refs/pull/21/head:refs/powerloom/pull-21`, then `git diff origin/main...refs/powerloom/pull-21`"), note);
        Assert.Contains($"[Open on GitHub](https://github.com/{Owner}/{Repo}/pull/21)", note);
    }

    private static GitHubPullRequest Pr(string repo, int number, string author, string[] reviewers, string head, bool draft = false)
    {
        return new GitHubPullRequest(Owner, repo, number, $"PR {number}", null, author, $"feature/{number}", head, "main", "b1", draft, reviewers, DateTime.UtcNow, $"https://github.com/{Owner}/{repo}/pull/{number}");
    }

    private Task<ITrackedSession> SyncAsync() => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncGitHubPullRequests(PowerLoomHost.Vault)).AsTask());

    private static string IdOf(string repo) => $"github:test-vault:{Owner}/{repo}";

    private async Task SeedAsync(string repo)
    {
        GitHub.Login = "sam";
        GitHub.Token = "good-token";

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await scope.ServiceProvider.GetRequiredService<GitHubSettingsStore>().SaveAsync(PowerLoomHost.Vault, new GitHubSettings { Enabled = true, Token = "good-token", Login = "sam" }, CancellationToken.None);

        if (!await db.Repos.AnyAsync(row => row.Id == IdOf(repo)))
            db.Repos.Add(new Repo { Id = IdOf(repo), Vault = PowerLoomHost.Vault, Kind = RepoKind.Github, AdoProject = Owner, Name = repo, RemoteUrl = $"https://github.com/{Owner}/{repo}.git", DefaultBranch = "main" });

        await db.SaveChangesAsync();
    }

    private async Task SaveAdoSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
    }

    private async Task<List<PullRequest>> RowsAsync(string repo)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PullRequests.AsNoTracking().Include(row => row.CodeReview).Where(row => row.RepoId == IdOf(repo)).OrderBy(row => row.Id).ToListAsync();
    }
}
