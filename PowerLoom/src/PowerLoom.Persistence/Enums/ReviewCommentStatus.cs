namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `review_comment_status`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum ReviewCommentStatus
{
    Open,
    Answered,
    Withdrawn,
    Outdated,
}
