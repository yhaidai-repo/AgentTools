namespace PowerLoom.AdoIntegration.Client.Models;

// A person's comment on a pull request thread (no system comments such as votes and pushes): which thread, who wrote it
// (unique name) and when.
public sealed record AdoThreadComment(int ThreadId, int CommentId, string? Author, DateTime? PublishedAt)
{
    // How the review remembers it saw a comment (`code_review.seen_comments`).
    public string Key => $"{ThreadId}:{CommentId}";
}
