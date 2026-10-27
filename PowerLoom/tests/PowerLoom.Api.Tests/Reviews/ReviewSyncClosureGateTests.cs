using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Domain.Reviews;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.Reviews;

[Collection(PowerLoomCollection.Name)]
public sealed class ReviewSyncClosureGateTests(PowerLoomHost host)
{
    private static int nextId = 888000;

    [Theory]
    [InlineData(false, "open")]
    [InlineData(false, "answered")]
    [InlineData(false, "running")]
    [InlineData(false, "clear")]
    [InlineData(true, "open")]
    [InlineData(true, "answered")]
    [InlineData(true, "running")]
    [InlineData(true, "clear")]
    public async Task Provider_unlisting_archives_comments_and_cancels_tasks_after_the_writer_finishes(bool github, string scenario)
    {
        var id = Interlocked.Increment(ref nextId);
        var vault = $"sync-gate-{id}";
        var queuedId = $"gate-sync-queued-{id}";
        var runningId = $"gate-sync-running-{id}";
        var commentId = $"gate-sync-comment-{id}";
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        db.Vaults.Add(new Vault { Name = vault, Features = "{}" });
        var pr = ReviewFixSeed.Pr(db, id, vault);
        pr.Origin = github ? PullRequestOrigin.Github : PullRequestOrigin.Sync;
        var queued = ReviewFixSeed.Item(db, queuedId, vault, "review");
        queued.Data = System.Text.Json.JsonSerializer.Serialize(new { prId = id });
        if (scenario == "running")
        {
            var running = ReviewFixSeed.Item(db, runningId, vault, "review");
            running.Data = queued.Data;
            running.Status = ItemStatus.InProgress;
        }
        if (scenario is "open" or "answered")
            db.ReviewComments.Add(new ReviewComment { Id = commentId, PrId = id, Commit = "c1", FilePath = "synthetic.cs", StartLine = 1, EndLine = 1, Severity = ReviewSeverity.Nit, Status = scenario == "open" ? ReviewCommentStatus.Open : ReviewCommentStatus.Answered, BodyMd = "Unsettled synthetic nit", CodeSnippet = "x", SnippetStartLine = 1, AnswerMd = scenario == "answered" ? "Please keep it" : null });
        await db.SaveChangesAsync();
        var expectedClose = scenario != "running";
        var summary = github
            ? await new GitHubPullRequestSync(db).RunAsync(vault, new GitHubSettings { Enabled = true, Login = "synthetic" }, new FakeGitHubClient(), CancellationToken.None)
            : await ActivatorUtilities.CreateInstance<PullRequestSync>(scope.ServiceProvider).RunAsync(vault, new AdoSettings { User = "synthetic" }, new PullRequestSettings(), new FakeAdoClient(), CancellationToken.None);
        Assert.Contains(expectedClose ? "1 closed" : "0 closed", summary);
        db.ChangeTracker.Clear();
        var persisted = await db.PullRequests.Include(row => row.CodeReview).SingleAsync(row => row.Id == id);
        Assert.False(persisted.IsListed);
        Assert.Equal(expectedClose ? ReviewStatus.Closed : ReviewStatus.Active, persisted.CodeReview!.Status);
        Assert.Equal(expectedClose ? ItemStatus.Cancelled : ItemStatus.Open, (await db.LocalItems.SingleAsync(row => row.Id == queuedId)).Status);
        if (!expectedClose)
            Assert.False(await db.StatusHistories.AnyAsync(row => row.EntityId == queuedId && row.ToStatus == "cancelled"));
        if (scenario == "running")
            Assert.Equal(ItemStatus.InProgress, (await db.LocalItems.SingleAsync(row => row.Id == runningId)).Status);
        if (scenario is "open" or "answered")
        {
            var comment = await db.ReviewComments.SingleAsync(row => row.Id == commentId);
            Assert.Equal(ReviewCommentStatus.Withdrawn, comment.Status);
            Assert.Equal("Unsettled synthetic nit", comment.BodyMd);
            Assert.Equal(scenario == "answered" ? "Please keep it" : null, comment.AnswerMd);
        }
        if (scenario == "running")
        {
            await db.LocalItems.Where(row => row.Id == runningId).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ItemStatus.Done));
            // The first check already unlisted the PR; retry must still finish closing its review.
            var retried = github
                ? await new GitHubPullRequestSync(db).RunAsync(vault, new GitHubSettings { Enabled = true, Login = "synthetic" }, new FakeGitHubClient(), CancellationToken.None)
                : await ActivatorUtilities.CreateInstance<PullRequestSync>(scope.ServiceProvider).RunAsync(vault, new AdoSettings { User = "synthetic" }, new PullRequestSettings(), new FakeAdoClient(), CancellationToken.None);
            Assert.Contains("1 closed", retried);
            db.ChangeTracker.Clear();
            Assert.Equal(ReviewStatus.Closed, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
            Assert.Equal(ItemStatus.Cancelled, (await db.LocalItems.SingleAsync(row => row.Id == queuedId)).Status);
            Assert.Equal(ItemStatus.Done, (await db.LocalItems.SingleAsync(row => row.Id == runningId)).Status);
        }
    }
}
