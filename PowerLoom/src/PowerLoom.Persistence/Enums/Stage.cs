namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `stage`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum Stage
{
    Sync,
    Refinement,
    Research,
    Design,
    TechWriter,
    PullRequests,
    CodeReview,
    VaultReview,
    BetterResearch,
}
