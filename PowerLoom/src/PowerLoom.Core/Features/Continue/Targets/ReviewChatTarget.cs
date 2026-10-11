using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// A review's chat (user decision 2026-10-05): review only, no fixes. The note holds the PR, PowerLoom's summary and the
// comments with their answers; the chat answers the open comments after the user's yes.
public sealed class ReviewChatTarget(PowerLoomDbContext db) : IChatTarget
{
    // Four backticks, so a snippet that holds a fence of its own doesn't end the block.
    private const string CodeFence = "````";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyList<string> Briefing =
    [
        "**What the PR does**: in short, in 2–3 sentences.",
        "**Risky spots**: with `file:line`.",
        "**Each open comment**: still valid? why, with `file:line`.",
        "**Missed by the review**: problems no comment names.",
    ];

    public ChatKind Kind => ChatKind.Review;

    public async Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation)
    {
        var review = int.TryParse(id, out var prId) ? await db.CodeReviews.AsNoTracking().Include(row => row.Pr).SingleOrDefaultAsync(row => row.PrId == prId, cancellation) : null;

        if (review is null)
            return Outcome<ChatBrief>.Failure(Problem.NotFound($"No review for PR {id}."));

        var pr = review.Pr;
        var comments = await db.ReviewComments.AsNoTracking()
            .Where(comment => comment.PrId == prId && comment.Status != ReviewCommentStatus.Withdrawn)
            .OrderBy(comment => comment.FilePath).ThenBy(comment => comment.StartLine).ThenBy(comment => comment.Id)
            .ToListAsync(cancellation);
        var source = BranchName(pr.SourceRef);
        var target = BranchName(pr.TargetRef);
        var brief = ChatBrief.For(pr.Vault, $"Review PR {prId}: {pr.Title}") with
        {
            Before =
            [
                $"Read the PR in the {pr.RepoName} repo without changing it: `git fetch origin`, then `git diff origin/{target}...origin/{source}`. No checkout, no file changes: review only.",
                "Read the Summary and Comments below, and the code around them.",
            ],
            Briefing = Briefing,
            Ending = "End the briefing by asking: \"Write the answers?\" After a yes: one answer per open comment, by its id, as plain text to paste into PowerLoom's review page.",
            Repos = [pr.RepoName],
            Sections =
            [
                new ChatSection("Pull request", PullRequestMarkdown(pr, review, source, target)),
                new ChatSection("Summary", review.SummaryMd ?? "Not reviewed yet."),
                new ChatSection("Comments", comments.Count > 0 ? string.Join("\n\n", comments.Select(CommentMarkdown)) : "None."),
            ],
            Rules = ["Review only: change no file."],
        };

        return Outcome<ChatBrief>.Success(brief);
    }

    private static string PullRequestMarkdown(PullRequest pr, CodeReview review, string source, string target)
    {
        var pbis = (JsonSerializer.Deserialize<List<int>>(pr.WorkItemIds, Json) ?? []).Select(adoId => $"[[{BacklogPaths.PbiNoteName(adoId)}]]").ToList();

        return $"[Open in Azure DevOps]({pr.Url}) · {pr.RepoName} · `{source}` → `{target}` · by {pr.Author ?? "–"}\n\n"
            + $"Latest commit `{pr.SourceCommit}`; reviewed commit `{review.ReviewedCommit ?? "none"}`. PBIs: {(pbis.Count > 0 ? string.Join(", ", pbis) : "none")}.";
    }

    private static string CommentMarkdown(ReviewComment comment)
    {
        var parts = new List<string>
        {
            $"### {comment.Id} · {Label(comment.Severity)} · {Label(comment.Status)}",
            $"`{comment.FilePath}:{comment.StartLine}-{comment.EndLine}`",
            comment.BodyMd,
            $"Code (from line {comment.SnippetStartLine}):\n\n{CodeFence}\n{comment.CodeSnippet}\n{CodeFence}",
        };

        if (comment.AnswerMd is not null)
            parts.Add($"**Answer:** {comment.AnswerMd}");

        if (comment.AgentReplyMd is not null)
            parts.Add($"**Agent reply:** {comment.AgentReplyMd}");

        return string.Join("\n\n", parts);
    }

    private static string Label<TEnum>(TEnum value) where TEnum : struct, Enum => new KebabCaseNameTranslator().TranslateMemberName(value.ToString());

    private static string BranchName(string reference) => reference.StartsWith("refs/heads/") ? reference["refs/heads/".Length..] : reference;
}
