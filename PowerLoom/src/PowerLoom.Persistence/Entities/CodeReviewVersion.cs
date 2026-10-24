namespace PowerLoom.Persistence.Entities;

// What one review run of a pull request concluded, kept per run so the review's versions stay readable (user decision
// 2026-10-21); code_review holds the latest. Written by Code review and Better Review.
public partial class CodeReviewVersion
{
    public int Id { get; set; }

    public int PrId { get; set; }

    // Null once the run is deleted: the version stays as the review's history.
    public long? RunId { get; set; }

    public string ReviewedCommit { get; set; } = null!;

    public int? ReviewedIteration { get; set; }

    // Null when the run gave no summary (Code review may not).
    public string? SummaryMd { get; set; }

    /// <summary>Better Review's result (jsonb), as code_review.details had it after this run; null for Code review.</summary>
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PullRequest Pr { get; set; } = null!;

    public virtual AgentRun? Run { get; set; }
}
