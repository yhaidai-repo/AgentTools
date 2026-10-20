namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `pipeline_status`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum PipelineStatus
{
    New,
    ReadyForRefinement,
    Refining,
    NeedsResearch,
    Researching,
    WaitingHuman,
    ReadyForDesign,
    Designing,
    ReadyForDev,
    Development,
    // The test stage (user decision 2026-10-21): a test task waits, runs, and its report had no failed case, or one.
    ReadyForTest,
    Testing,
    Tested,
    TestFailed,
    Done,
    Stale,
    Closed,
}
