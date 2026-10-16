using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Reviews;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Ado;

[Collection(PowerLoomCollection.Name)]
public sealed class SyncPullRequestsTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Your_pull_requests_get_a_review_and_one_that_leaves_the_list_closes_it()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.PullRequests =
        [
            PullRequest(7101, "PVS", "sam@x.io", "c1"),
            PullRequest(7102, "PVS", "sam@x.io", "c1", author: "sam@x.io"),
            PullRequest(7103, "PVS", "pat@x.io", "c1"),
            PullRequest(7104, "PVS", "sam@x.io", "c1", draft: true),
            PullRequest(7105, "PVS", "pat@x.io", "c1", author: "sam@x.io"),
        ];
        ado.Details[7101] = new AdoPullRequestDetails(2, [51001]);

        await Sync();
        var mirrored = await LoadAsync();

        Assert.Equal([7101, 7102, 7104, 7105], mirrored.Keys.Where(id => id is >= 7100 and < 7200).Order());
        Assert.Equal((2, "[51001]", ReviewStatus.Active), (mirrored[7101].Iteration, mirrored[7101].WorkItemIds, mirrored[7101].CodeReview!.Status));
        Assert.Null(mirrored[7104].CodeReview);
        Assert.Equal(RunOutcome.Success, await LastRunOutcomeAsync());

        ado.PullRequests = [PullRequest(7104, "PVS", "sam@x.io", "c2")];

        await Sync();
        var after = await LoadAsync();

        Assert.Equal((false, ReviewStatus.Closed), (after[7101].IsListed, after[7101].CodeReview!.Status));
        Assert.Contains("completed or abandoned", after[7101].CodeReview!.ClosedReason);
        Assert.Equal(("c2", ReviewStatus.Active), (after[7104].SourceCommit, after[7104].CodeReview!.Status));
    }

    [Fact]
    public async Task A_pull_request_in_a_disabled_repo_gets_no_review_and_its_open_review_closes()
    {
        await ConfigureAsync();
        await AddRepoAsync("r-Legacy", "Legacy");

        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.PullRequests = [PullRequest(7201, "Legacy", "sam@x.io", "c1")];

        await Sync();
        var before = await LoadAsync();

        Assert.Equal(ReviewStatus.Active, before[7201].CodeReview!.Status);

        await SetExcludedAsync("r-Legacy", true);
        await Sync();
        var after = await LoadAsync();

        Assert.Equal((false, ReviewStatus.Closed), (after[7201].IsListed, after[7201].CodeReview!.Status));
        Assert.Contains("disabled", after[7201].CodeReview!.ClosedReason);
    }

    [Fact]
    public async Task Another_reviewers_new_comment_on_a_reviewed_pull_request_queues_a_follow_up_review_in_the_pool()
    {
        await ConfigureAsync();
        await SetBetterReviewAsync(true);

        try
        {
            var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;
            var reviewedAt = DateTime.UtcNow.AddHours(-1);

            ado.PullRequests = [PullRequest(7401, "PVS", "sam@x.io", "c1")];
            ado.Threads[7401] = [new AdoThreadComment(1, 1, "lee@x.io", reviewedAt.AddHours(-1))];

            await Sync();
            Assert.Empty(await ReviewTasksAsync(7401));

            await MarkReviewedAsync(7401, reviewedAt);
            ado.Threads[7401] =
            [
                new AdoThreadComment(1, 1, "lee@x.io", reviewedAt.AddHours(-1)),
                new AdoThreadComment(2, 1, "sam@x.io", DateTime.UtcNow),
                new AdoThreadComment(3, 1, "pat@x.io", DateTime.UtcNow),
            ];

            await Sync();
            Assert.Empty(await ReviewTasksAsync(7401));

            ado.Threads[7401] = [.. ado.Threads[7401], new AdoThreadComment(1, 2, "Lee@x.io", DateTime.UtcNow)];

            await Sync();
            await Sync();
            var queued = Assert.Single(await ReviewTasksAsync(7401));

            Assert.Equal(("agent:*", ItemStatus.Open), (queued.Assignee, queued.Status));
            using var data = JsonDocument.Parse(queued.Data!);

            Assert.Equal("reviewer-comments", data.RootElement.GetProperty("trigger").GetString());
            Assert.Equal([1], data.RootElement.GetProperty("threads").EnumerateArray().Select(thread => thread.GetInt32()));

            await SetTaskStatusAsync(queued.Id, ItemStatus.Done);
            await Sync();
            Assert.Single(await ReviewTasksAsync(7401));

            ado.PullRequests = [PullRequest(7401, "PVS", "sam@x.io", "c2")];

            await Sync();
            Assert.Single(await ReviewTasksAsync(7401));
        }
        finally
        {
            await SetBetterReviewAsync(false);
        }
    }

    [Fact]
    public async Task Reviewer_comments_queue_nothing_while_better_review_is_off()
    {
        await ConfigureAsync();
        await SetBetterReviewAsync(false);

        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.PullRequests = [PullRequest(7311, "PVS", "sam@x.io", "c1")];

        await Sync();
        await MarkReviewedAsync(7311, DateTime.UtcNow.AddHours(-1));
        ado.Threads[7311] = [new AdoThreadComment(1, 1, "lee@x.io", DateTime.UtcNow)];

        await Sync();

        Assert.Empty(await ReviewTasksAsync(7311));
    }

    private static AdoPullRequest PullRequest(int id, string repo, string reviewer, string commit, string author = "pat@x.io", bool draft = false)
    {
        return new AdoPullRequest(id, $"r-{repo}", repo, $"PR {id}", null, draft, author, "refs/heads/f", "refs/heads/main", commit, "t1", [reviewer], "2026-10-01T10:00:00Z", $"https://x/pr/{id}");
    }

    private Task<ITrackedSession> Sync() => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncPullRequests(PowerLoomHost.Vault)).AsTask());

    private async Task ConfigureAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<AdoSettingsStore>();

        await store.SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
    }

    private async Task<Dictionary<int, PullRequest>> LoadAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PullRequests.AsNoTracking().Include(pr => pr.CodeReview).ToDictionaryAsync(pr => pr.Id);
    }

    private async Task<RunOutcome> LastRunOutcomeAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().AgentRuns.AsNoTracking().Where(run => run.Stage == Stage.PullRequests).OrderByDescending(run => run.Id).Select(run => run.Outcome).FirstAsync();
    }

    private async Task SetBetterReviewAsync(bool enabled)
    {
        using var scope = host.Host.Services.CreateScope();
        var definition = JsonSerializer.Serialize(new { id = "better-review", label = "Better Review", enabled, handles = new[] { "review" }, capabilities = new { integrations = new { adoTestCases = true } } });

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.ExecuteSqlAsync($"INSERT INTO agent_config.agent (id, definition) VALUES ('better-review', {definition}::jsonb) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition");
    }

    private async Task MarkReviewedAsync(int prId, DateTime reviewedAt)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().CodeReviews.Where(review => review.PrId == prId).ExecuteUpdateAsync(set => set.SetProperty(review => review.ReviewedAt, reviewedAt).SetProperty(review => review.ReviewedCommit, "c1"));
    }

    private async Task<List<LocalItem>> ReviewTasksAsync(int prId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await ReviewTasks.Of(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), prId).AsNoTracking().ToListAsync();
    }

    private async Task SetTaskStatusAsync(string id, ItemStatus status)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.Where(item => item.Id == id).ExecuteUpdateAsync(set => set.SetProperty(item => item.Status, status));
    }

    private async Task AddRepoAsync(string id, string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.Repos.Add(new Repo { Id = id, AdoProject = "Proj", Name = name, RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });

        await db.SaveChangesAsync();
    }

    private async Task SetExcludedAsync(string id, bool excluded)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Repos.Where(repo => repo.Id == id).ExecuteUpdateAsync(set => set.SetProperty(repo => repo.Excluded, excluded));
    }
}
