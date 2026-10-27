using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Migrations;

namespace PowerLoom.Api.Tests.Reviews;

[Collection(PowerLoomCollection.Name)]
public sealed class ArchivedReviewItemsTests(PowerLoomHost host)
{
    [Fact]
    public async Task Repair_archives_only_closed_review_comments_and_waiting_tasks_without_losing_history()
    {
        const int closedId = 893001;
        const int activeId = 893002;
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        ReviewFixSeed.Pr(db, closedId, PowerLoomHost.Vault);
        ReviewFixSeed.Pr(db, activeId, PowerLoomHost.Vault);
        db.CodeReviews.Local.Single(row => row.PrId == closedId).Status = ReviewStatus.Closed;
        foreach (var (name, status, prId, kind) in new[] {
            ("queued", ItemStatus.Open, closedId, "review"), ("blocked", ItemStatus.Blocked, closedId, "review"),
            ("done", ItemStatus.Done, closedId, "review"), ("running", ItemStatus.InProgress, closedId, "review"),
            ("active", ItemStatus.Open, activeId, "review"), ("other-kind", ItemStatus.Open, closedId, "docs") })
        {
            var item = ReviewFixSeed.Item(db, $"archive-repair-{name}", PowerLoomHost.Vault, kind);
            item.Data = System.Text.Json.JsonSerializer.Serialize(new { prId });
            item.Status = status;
        }
        foreach (var (name, status, prId) in new[] { ("open", ReviewCommentStatus.Open, closedId), ("answered", ReviewCommentStatus.Answered, closedId), ("fixed", ReviewCommentStatus.Fixed, closedId), ("active", ReviewCommentStatus.Open, activeId) })
            db.ReviewComments.Add(new ReviewComment { Id = $"archive-repair-{name}", PrId = prId, Commit = "head", FilePath = "synthetic.cs", StartLine = 1, EndLine = 1, Severity = ReviewSeverity.Nit, Status = status, BodyMd = "Keep historical finding", CodeSnippet = "x", SnippetStartLine = 1, AnswerMd = "Keep historical answer", AgentReplyMd = "Keep historical reply" });
        await db.SaveChangesAsync();
        for (var pass = 0; pass < 2; pass++)
            foreach (var operation in new CloseArchivedReviewItems().UpOperations.OfType<SqlOperation>())
                await db.Database.ExecuteSqlRawAsync(operation.Sql);
        db.ChangeTracker.Clear();
        foreach (var name in new[] { "open", "answered" })
        {
            var comment = await db.ReviewComments.SingleAsync(row => row.Id == $"archive-repair-{name}");
            Assert.Equal(ReviewCommentStatus.Withdrawn, comment.Status);
            Assert.Equal("Keep historical finding", comment.BodyMd);
            Assert.Equal("Keep historical answer", comment.AnswerMd);
            Assert.Equal("Keep historical reply", comment.AgentReplyMd);
        }
        Assert.Equal(ReviewCommentStatus.Fixed, (await db.ReviewComments.SingleAsync(row => row.Id == "archive-repair-fixed")).Status);
        Assert.Equal(ReviewCommentStatus.Open, (await db.ReviewComments.SingleAsync(row => row.Id == "archive-repair-active")).Status);
        foreach (var name in new[] { "queued", "blocked" })
        {
            var item = await db.LocalItems.SingleAsync(row => row.Id == $"archive-repair-{name}");
            Assert.Equal(ItemStatus.Cancelled, item.Status);
            Assert.NotNull(item.ClosedAt);
            Assert.Single(await db.StatusHistories.Where(row => row.EntityId == item.Id && row.ToStatus == "cancelled").ToListAsync());
        }
        Assert.Equal(ItemStatus.Done, (await db.LocalItems.SingleAsync(row => row.Id == "archive-repair-done")).Status);
        Assert.Equal(ItemStatus.InProgress, (await db.LocalItems.SingleAsync(row => row.Id == "archive-repair-running")).Status);
        Assert.Equal(ItemStatus.Open, (await db.LocalItems.SingleAsync(row => row.Id == "archive-repair-active")).Status);
        Assert.Equal(ItemStatus.Open, (await db.LocalItems.SingleAsync(row => row.Id == "archive-repair-other-kind")).Status);
    }
}
