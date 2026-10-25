using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Reviews;

[Collection(PowerLoomCollection.Name)]
public sealed class ReviewsTests(PowerLoomHost host)
{
    private const int PrId = 7301;

    [Fact]
    public async Task A_review_is_queued_once_its_comment_answered_then_closed_and_deleted()
    {
        await SeedAsync();

        var queued = await host.Host.PostJson(new ReviewIds([PrId, 7399]), "/api/reviews/queue").Receive<ReviewsResult>();
        var again = await host.Host.PostJson(new ReviewIds([PrId]), "/api/reviews/queue").Receive<ReviewsResult>();
        var answered = await host.Host.PostJson(new AnswerRequest("Fixed it"), $"/api/review-comments/rc-{PrId}-1/answer").Receive<AnsweredComment>();
        var commentStatus = await CommentStatusAsync();
        var closed = await host.Host.PostJson(new CloseReviewsRequest([PrId], "later"), "/api/reviews/close").Receive<ReviewsResult>();
        var reviewAfterClose = await LoadReviewAsync();
        var taskAfterClose = await LoadTaskAsync(queued!.Done[0].Value);
        var deleted = await DeleteAsync();

        Assert.Equal(($"CR-{PrId}-001", 1), (queued.Done[0].Value, queued.Refused.Count));
        Assert.Contains("is already queued", again!.Refused[0]);
        Assert.Equal((PrId, true), (answered!.PrId, answered.Answered));
        Assert.Equal(ReviewCommentStatus.Answered, commentStatus);
        Assert.Equal("closed", closed!.Done[0].Value);
        Assert.Equal((ReviewStatus.Closed, "later"), (reviewAfterClose!.Status, reviewAfterClose.ClosedReason));
        Assert.Equal(ItemStatus.Cancelled, taskAfterClose.Status);
        Assert.Equal(("Queue me", 0), (deleted.Done[0].Value, deleted.Refused.Count));
        Assert.Null(await LoadReviewAsync());
        Assert.True(await RememberedAsync());
    }

    private async Task<ReviewsResult> DeleteAsync()
    {
        var response = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new ReviewIds([PrId])).ToUrl("/api/reviews");
            scenario.StatusCodeShouldBeOk();
        });

        return response.ReadAsJson<ReviewsResult>()!;
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.PullRequests.Add(new PullRequest { Id = PrId, Vault = PowerLoomHost.Vault, RepoId = "r", RepoName = "POS", Title = "Queue me", SourceRef = "refs/heads/f", TargetRef = "refs/heads/main", SourceCommit = "c1", WorkItemIds = "[]", Url = "https://x", IsListed = true, Iteration = 1 });
        db.CodeReviews.Add(new CodeReview { PrId = PrId, Status = ReviewStatus.Closed, ClosedReason = "old" });
        db.ReviewComments.Add(new ReviewComment { Id = $"rc-{PrId}-1", PrId = PrId, Commit = "c1", FilePath = "a.cs", StartLine = 1, EndLine = 2, BodyMd = "Why?", CodeSnippet = "x", SnippetStartLine = 1, Severity = ReviewSeverity.Minor, Status = ReviewCommentStatus.Open });

        await db.SaveChangesAsync();
    }

    private async Task<CodeReview?> LoadReviewAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().CodeReviews.AsNoTracking().SingleOrDefaultAsync(review => review.PrId == PrId);
    }

    private async Task<LocalItem> LoadTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<ReviewCommentStatus> CommentStatusAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().ReviewComments.AsNoTracking().Where(comment => comment.Id == $"rc-{PrId}-1").Select(comment => comment.Status).SingleAsync();
    }

    private async Task<bool> RememberedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.DeletedPullRequests.AnyAsync(row => row.Id == PrId) && !await db.PullRequests.AnyAsync(row => row.Id == PrId) && !await db.LocalItems.AnyAsync(item => item.Id == $"CR-{PrId}-001");
    }
}
