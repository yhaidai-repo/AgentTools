namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `review_comment_status`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum ReviewCommentStatus
{
    Open,
    Answered,
    Withdrawn,
    Outdated,
    // A follow-up review found the code now fixes it (Better Review, 2026-10-16).
    Fixed,
}
