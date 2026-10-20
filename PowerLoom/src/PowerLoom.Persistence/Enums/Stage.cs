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
    BetterRefinement,
    // Turns a recorded meeting into notes and follow-ups (tools/audio-capture; design 2026-10-14).
    MeetingNotes,
    // Reviews a pull request against its PBIs, the project's review rules and the other reviewers (design 2026-10-16).
    BetterReview,
    // Analyses acceptance criteria against test cases, plans and runs the cases on a DevHub stack (design 2026-10-20).
    Autotest,
}
