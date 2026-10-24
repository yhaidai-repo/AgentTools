namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `item_status`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum ItemStatus
{
    Open,
    InProgress,
    Done,
    Blocked,
    Cancelled,
    Answered,
    Dismissed,
    Draft,
    Final,
    Superseded,
    Deleted,
}
