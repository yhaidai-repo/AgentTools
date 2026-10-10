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
    Done,
    Stale,
    Closed,
}
