using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Domain.Reviews;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Reviews;

[Collection(PowerLoomCollection.Name)]
public sealed class ReviewClosureGateTests(PowerLoomHost host)
{
    private static int nextId = 887000;

    [Theory]
    [InlineData(ReviewSeverity.Blocker, ReviewCommentStatus.Open)]
    [InlineData(ReviewSeverity.Major, ReviewCommentStatus.Open)]
    [InlineData(ReviewSeverity.Minor, ReviewCommentStatus.Open)]
    [InlineData(ReviewSeverity.Nit, ReviewCommentStatus.Open)]
    [InlineData(ReviewSeverity.Blocker, ReviewCommentStatus.Answered)]
    [InlineData(ReviewSeverity.Major, ReviewCommentStatus.Answered)]
    [InlineData(ReviewSeverity.Minor, ReviewCommentStatus.Answered)]
    [InlineData(ReviewSeverity.Nit, ReviewCommentStatus.Answered)]
    public async Task Closing_withdraws_unresolved_comments_and_cancels_review_tasks(ReviewSeverity severity, ReviewCommentStatus status)
    {
        var id = await SeedAsync(severity, status);
        string taskId;
        using (var seedScope = host.Host.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            taskId = (await ReviewQueueing.QueueAsync(seedDb, id, CancellationToken.None)).Value!;
        }
        var result = await CloseAsync(id);
        Assert.Single(result.Done);
        Assert.Empty(result.Refused);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        Assert.Equal(ReviewStatus.Closed, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
        var comment = await db.ReviewComments.SingleAsync(row => row.PrId == id);
        Assert.Equal(ReviewCommentStatus.Withdrawn, comment.Status);
        Assert.Equal("Synthetic finding", comment.BodyMd);
        Assert.Equal(ItemStatus.Cancelled, (await db.LocalItems.SingleAsync(row => row.Id == taskId)).Status);
        Assert.True(await db.StatusHistories.AnyAsync(row => row.EntityId == taskId && row.ToStatus == "cancelled"));
    }

    [Fact]
    public async Task Running_writer_blocks_close_and_preserves_queued_work_until_it_finishes()
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Open);
        var runningId = $"gate-running-{id}";
        var queuedId = $"gate-queued-{id}";
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        foreach (var taskId in new[] { runningId, queuedId })
        {
            var task = ReviewFixSeed.Item(db, taskId, PowerLoomHost.Vault, "review");
            task.Data = System.Text.Json.JsonSerializer.Serialize(new { prId = id });
            task.Status = taskId == runningId ? ItemStatus.InProgress : ItemStatus.Open;
        }
        await db.SaveChangesAsync();
        var refused = await CloseAsync(id);
        Assert.Empty(refused.Done);
        Assert.Contains("running", Assert.Single(refused.Refused));
        db.ChangeTracker.Clear();
        Assert.Equal(ItemStatus.InProgress, (await db.LocalItems.SingleAsync(row => row.Id == runningId)).Status);
        Assert.Equal(ItemStatus.Open, (await db.LocalItems.SingleAsync(row => row.Id == queuedId)).Status);
        Assert.Equal(ReviewCommentStatus.Open, (await db.ReviewComments.SingleAsync(row => row.PrId == id)).Status);
        Assert.Equal(ReviewStatus.Active, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
        await db.LocalItems.Where(row => row.Id == runningId).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ItemStatus.Done));
        Assert.Single((await CloseAsync(id)).Done);
        db.ChangeTracker.Clear();
        Assert.Equal(ItemStatus.Done, (await db.LocalItems.SingleAsync(row => row.Id == runningId)).Status);
        Assert.Equal(ItemStatus.Cancelled, (await db.LocalItems.SingleAsync(row => row.Id == queuedId)).Status);
        Assert.Equal(ReviewCommentStatus.Withdrawn, (await db.ReviewComments.SingleAsync(row => row.PrId == id)).Status);
    }

    [Theory]
    [InlineData(ReviewCommentStatus.Fixed)]
    [InlineData(ReviewCommentStatus.Withdrawn)]
    [InlineData(ReviewCommentStatus.Outdated)]
    public async Task Settled_comments_allow_close(ReviewCommentStatus status)
    {
        var id = await SeedAsync(ReviewSeverity.Nit, status);
        Assert.Single((await CloseAsync(id)).Done);
    }

    [Fact]
    public async Task Close_waits_for_a_publisher_then_archives_its_new_comment()
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Fixed);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.CodeReviews.FromSqlInterpolated($"SELECT * FROM code_review WHERE pr_id={id} FOR UPDATE").SingleAsync();
        var closing = CloseAsync(id);
        await WaitForBlockedRequestsAsync(1);
        await db.ReviewComments.Where(row => row.PrId == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ReviewCommentStatus.Open));
        await transaction.CommitAsync();
        Assert.Single((await closing).Done);
        Assert.Equal(ReviewCommentStatus.Withdrawn, (await db.ReviewComments.AsNoTracking().SingleAsync(row => row.PrId == id)).Status);
    }

    [Theory]
    [InlineData(ItemStatus.Open)]
    [InlineData(ItemStatus.Blocked)]
    public async Task Stale_tracked_task_cannot_hide_a_running_writer(ItemStatus trackedStatus)
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Open);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = ReviewFixSeed.Item(db, $"gate-stale-{id}", PowerLoomHost.Vault, "review");
        task.Data = System.Text.Json.JsonSerializer.Serialize(new { prId = id });
        task.Status = trackedStatus;
        var waiting = ReviewFixSeed.Item(db, $"gate-stale-waiting-{id}", PowerLoomHost.Vault, "review");
        waiting.Data = task.Data;
        waiting.Status = trackedStatus;
        await db.SaveChangesAsync();
        using (var otherScope = host.Host.Services.CreateScope())
        {
            var other = otherScope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            await other.LocalItems.Where(row => row.Id == task.Id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ItemStatus.InProgress));
        }
        Assert.Equal(trackedStatus, task.Status);
        var refusal = await PowerLoom.Persistence.Reviews.ReviewClosing.CloseAsync(db, id, "Synthetic", "human", CancellationToken.None);
        Assert.Contains("running", refusal!);
        db.ChangeTracker.Clear();
        Assert.Equal(ItemStatus.InProgress, (await db.LocalItems.SingleAsync(row => row.Id == task.Id)).Status);
        Assert.Null((await db.LocalItems.SingleAsync(row => row.Id == task.Id)).ClosedAt);
        Assert.Equal(trackedStatus, (await db.LocalItems.SingleAsync(row => row.Id == waiting.Id)).Status);
        Assert.Equal(ReviewStatus.Active, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
        Assert.Equal(ReviewCommentStatus.Open, (await db.ReviewComments.SingleAsync(row => row.PrId == id)).Status);
        Assert.False(await db.StatusHistories.AnyAsync(row => row.EntityId == task.Id && row.ToStatus == "cancelled"));
        await db.LocalItems.Where(row => row.Id == task.Id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ItemStatus.Done));
        Assert.Null(await PowerLoom.Persistence.Reviews.ReviewClosing.CloseAsync(db, id, "Synthetic", "human", CancellationToken.None));
        db.ChangeTracker.Clear();
        Assert.Equal(ItemStatus.Done, (await db.LocalItems.SingleAsync(row => row.Id == task.Id)).Status);
        Assert.Equal(ItemStatus.Cancelled, (await db.LocalItems.SingleAsync(row => row.Id == waiting.Id)).Status);
        var history = Assert.Single(await db.StatusHistories.Where(row => row.EntityId == waiting.Id && row.ToStatus == "cancelled").ToListAsync());
        Assert.Equal(trackedStatus == ItemStatus.Open ? "open" : "blocked", history.FromStatus);
        Assert.Equal(ReviewStatus.Closed, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
        Assert.Equal(ReviewCommentStatus.Withdrawn, (await db.ReviewComments.SingleAsync(row => row.PrId == id)).Status);
    }

    [Fact]
    public async Task Closing_cancels_blocked_work_once_and_preserves_completed_and_unrelated_tasks()
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Fixed);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var blocked = ReviewFixSeed.Item(db, $"gate-blocked-{id}", PowerLoomHost.Vault, "review");
        blocked.Data = System.Text.Json.JsonSerializer.Serialize(new { prId = id });
        blocked.Status = ItemStatus.Blocked;
        var done = ReviewFixSeed.Item(db, $"gate-done-{id}", PowerLoomHost.Vault, "review");
        done.Data = blocked.Data;
        done.Status = ItemStatus.Done;
        var unrelated = ReviewFixSeed.Item(db, $"gate-unrelated-{id}", PowerLoomHost.Vault, "review");
        unrelated.Data = System.Text.Json.JsonSerializer.Serialize(new { prId = id + 10000 });
        await db.SaveChangesAsync();
        Assert.Single((await CloseAsync(id)).Done);
        Assert.Single((await CloseAsync(id)).Done);
        db.ChangeTracker.Clear();
        var closedTask = await db.LocalItems.SingleAsync(row => row.Id == blocked.Id);
        Assert.Equal(ItemStatus.Cancelled, closedTask.Status);
        Assert.NotNull(closedTask.ClosedAt);
        Assert.Single(await db.StatusHistories.Where(row => row.EntityId == blocked.Id && row.ToStatus == "cancelled").ToListAsync());
        Assert.Equal(ItemStatus.Done, (await db.LocalItems.SingleAsync(row => row.Id == done.Id)).Status);
        Assert.Equal(ItemStatus.Open, (await db.LocalItems.SingleAsync(row => row.Id == unrelated.Id)).Status);
    }

    [Fact]
    public async Task Answering_a_historical_open_comment_cannot_reopen_a_closed_review()
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Open);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await db.CodeReviews.Where(row => row.PrId == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ReviewStatus.Closed));
        await host.Host.Scenario(scenario => {
            scenario.Post.Json(new AnswerRequest("Late answer")).ToUrl($"/api/review-comments/gate-{id}/answer");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
        Assert.Equal(ReviewStatus.Closed, (await db.CodeReviews.SingleAsync(row => row.PrId == id)).Status);
        var comment = await db.ReviewComments.SingleAsync(row => row.PrId == id);
        Assert.Equal(ReviewCommentStatus.Open, comment.Status);
        Assert.Null(comment.AnswerMd);
    }

    [Fact]
    public async Task A_waiting_human_answer_cannot_resurrect_a_settled_comment_after_closure()
    {
        var id = await SeedAsync(ReviewSeverity.Nit, ReviewCommentStatus.Open);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.CodeReviews.FromSqlInterpolated($"SELECT * FROM code_review WHERE pr_id={id} FOR UPDATE").SingleAsync();
        var answering = host.Host.Scenario(scenario => {
            scenario.Post.Json(new AnswerRequest("Late answer")).ToUrl($"/api/review-comments/gate-{id}/answer");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
        await WaitForBlockedRequestsAsync(1);
        await db.ReviewComments.Where(row => row.PrId == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ReviewCommentStatus.Withdrawn));
        // Simulate the serialized publisher/closer's final state while the real answer request is waiting.
        await db.CodeReviews.Where(row => row.PrId == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ReviewStatus.Closed));
        await transaction.CommitAsync();
        await answering;
        Assert.Equal(ReviewCommentStatus.Withdrawn, (await db.ReviewComments.SingleAsync(row => row.PrId == id)).Status);
        Assert.Equal(ReviewStatus.Closed, (await db.CodeReviews.AsNoTracking().SingleAsync(row => row.PrId == id)).Status);
    }

    private async Task WaitForBlockedRequestsAsync(int count)
    {
        // Observe outside the publisher transaction: PostgreSQL caches activity statistics within a transaction.
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%code_review%'").SingleAsync(timeout.Token) < count)
            await Task.Delay(20, timeout.Token);
    }

    private async Task<ReviewsResult> CloseAsync(int id) => (await host.Host.PostJson(new CloseReviewsRequest([id], "Synthetic"), "/api/reviews/close").Receive<ReviewsResult>())!;

    private async Task<int> SeedAsync(ReviewSeverity severity, ReviewCommentStatus status)
    {
        var id = Interlocked.Increment(ref nextId);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        ReviewFixSeed.Pr(db, id, PowerLoomHost.Vault);
        db.ReviewComments.Add(new ReviewComment { Id = $"gate-{id}", PrId = id, Commit = "c1", FilePath = "synthetic.cs", StartLine = 1, EndLine = 1, Severity = severity, Status = status, BodyMd = "Synthetic finding", CodeSnippet = "x", SnippetStartLine = 1 });
        await db.SaveChangesAsync();
        return id;
    }
}
