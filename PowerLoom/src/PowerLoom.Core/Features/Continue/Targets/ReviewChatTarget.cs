using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.PullRequests;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.Features.Continue.Targets;

// A review's chat (user decision 2026-10-05): review only, no fixes. The note holds the PR, PowerLoom's summary and the
// comments with their answers; after the user's yes the chat answers the open comments in PowerLoom, one tool call per
// comment (user decision 2026-10-21).
public sealed class ReviewChatTarget(PowerLoomDbContext db) : IChatTarget
{
    // Four backticks, so a snippet that holds a fence of its own doesn't end the block.
    private const string CodeFence = "````";


    // One call per answered comment; an empty answer takes an answer back. The next review run reads the answers.
    private static readonly string AtTheEnd = "Show the user every answer first and call the tool only after their yes.\n"
        + $"- Answer a comment: `{ChatNote.Tool("review.answerComment")}` with `{{\"commentId\":\"<id from Comments>\",\"answer\":\"<the answer, markdown>\"}}`, once per comment.";

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
        var isLocalRepo = pr.Origin == PullRequestOrigin.LocalRepo;
        var brief = ChatBrief.For(pr.Vault, isLocalRepo ? $"Review local branch {source} of {pr.RepoName}" : $"Review PR {prId}: {pr.Title}") with
        {
            Pbis = LinkedPbis(pr),
            Before =
            [
                isLocalRepo ? LocalDiffStep(pr.RepoName, source, target) : RemoteDiffStep(pr.RepoName, source, target),
                "Read the Summary and Comments below, and the code around them.",
            ],
            Briefing = Briefing,
            Ending = "End the briefing by asking: \"Write the answers?\" After a yes: show one answer per open comment, by its id, and once the user agrees to them, send each with the command under At the end.",
            Repos = [pr.RepoName],
            Sections =
            [
                new ChatSection("Pull request", PullRequestMarkdown(pr, review, source, target)),
                new ChatSection("Summary", review.SummaryMd ?? "Not reviewed yet."),
                new ChatSection("Comments", comments.Count > 0 ? string.Join("\n\n", comments.Select(CommentMarkdown)) : "None."),
                new ChatSection(ItemChatEndings.Heading, AtTheEnd),
            ],
            Rules = ["Review only: change no file. PowerLoom is written only through the command under At the end, after the user's yes; nothing is pasted."],
        };

        return Outcome<ChatBrief>.Success(brief);
    }

    private static List<int> LinkedPbis(PullRequest pr) => PullRequestWorkItems.Parse(pr.WorkItemIds);

    private static string RemoteDiffStep(string repo, string source, string target) => $"Read the PR in the {repo} repo without changing it: `git fetch origin`, then `git diff origin/{target}...origin/{source}`. No checkout, no file changes: review only.";

    // A local repo's branches are in the checkout itself: nothing to fetch.
    private static string LocalDiffStep(string repo, string source, string target) => $"Read the branch in the {repo} repo without changing it: `git diff {target}...{source}` (both are local branches). No checkout, no file changes: review only.";

    private static string PullRequestMarkdown(PullRequest pr, CodeReview review, string source, string target)
    {
        var pbis = LinkedPbis(pr).Select(adoId => $"[[{BacklogPaths.PbiNoteName(adoId)}]]").ToList();

        var link = pr.Url.Length > 0 ? $"[Open in Azure DevOps]({pr.Url}) · " : "";

        return $"{link}{pr.RepoName} · `{source}` → `{target}` · by {pr.Author ?? "–"}\n\n"
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
