using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class ReviewChatTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_note_holds_the_pull_request_its_summary_and_the_open_comments()
    {
        await StoreReviewAsync(501);

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Review, "501"), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "review-501.md"));

        Assert.Contains(Uri.EscapeDataString("D:/pc/repos/PVS"), link!.Url);
        Assert.Contains("# Review PR 501: Cache the lookups", note);
        Assert.Contains("`git diff origin/development...origin/feature/501-cache`", note);
        Assert.Contains("[Open in Azure DevOps](https://dev.azure.com/x/pr/501) · PVS · `feature/501-cache` → `development` · by Sam", note);
        Assert.Contains("PBIs: [[PBI-31001]]", note);
        Assert.Contains("pbi.read '{\"ref\":\"PBI-31001\"}'", note);
        Assert.Contains("## Summary\n\nLooks fine, one risk.", note);
        Assert.Contains("### RC-501-1 · major · open", note);
        Assert.Contains("`Cache.cs:10-12`", note);
        Assert.DoesNotContain("RC-501-2", note);
        Assert.Contains("- Review only: change no file.", note);
        Assert.Contains("review.answerComment` with `{\"commentId\":\"<id from Comments>\"", note);
    }

    private async Task StoreReviewAsync(int prId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.Repos.Add(new Repo { Id = "repo-pvs", AdoProject = "proj", Name = "PVS", RemoteUrl = "https://dev.azure.com/x/_git/PVS", Vault = PowerLoomHost.Vault });
        db.PullRequests.Add(new PullRequest
        {
            Id = prId,
            RepoId = "repo-pvs",
            RepoName = "PVS",
            Title = "Cache the lookups",
            Author = "Sam",
            SourceRef = "refs/heads/feature/501-cache",
            TargetRef = "refs/heads/development",
            SourceCommit = "abc1234",
            Iteration = 1,
            WorkItemIds = "[31001]",
            Url = "https://dev.azure.com/x/pr/501",
            Vault = PowerLoomHost.Vault,
        });
        db.CodeReviews.Add(new CodeReview { PrId = prId, SummaryMd = "Looks fine, one risk.", ReviewedCommit = "abc1234" });
        db.ReviewComments.Add(Comment(prId, "RC-501-1", ReviewCommentStatus.Open));
        db.ReviewComments.Add(Comment(prId, "RC-501-2", ReviewCommentStatus.Withdrawn));

        await db.SaveChangesAsync();
    }

    private static ReviewComment Comment(int prId, string id, ReviewCommentStatus status)
    {
        return new ReviewComment
        {
            Id = id,
            PrId = prId,
            Commit = "abc1234",
            FilePath = "Cache.cs",
            StartLine = 10,
            EndLine = 12,
            BodyMd = "The cache never expires.",
            CodeSnippet = "var cache = new Dictionary<string, int>();",
            SnippetStartLine = 9,
            Severity = ReviewSeverity.Major,
            Status = status,
        };
    }
}
