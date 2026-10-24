namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `run_outcome`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum RunOutcome
{
    Running,
    Success,
    NoOp,
    Failed,
    BudgetExceeded,
    GateRejected,
    RateLimited,
    Timeout,
    Aborted,
    MaxTurns,
}
