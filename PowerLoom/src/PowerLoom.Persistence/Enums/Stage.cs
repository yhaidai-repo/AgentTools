namespace PowerLoom.Persistence.Enums;

// History only: the PostgreSQL enum `stage` that agent_run.stage had until 2026-10-23, kept for the migrations that
// created it. The column is text now (any agent id, also agents created in the UI); jobs use JobStages.
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
    // Runs of agents created in the UI, on the generic executor (user decision 2026-10-22); the agent id is in the run's labels.
    Custom,
}
