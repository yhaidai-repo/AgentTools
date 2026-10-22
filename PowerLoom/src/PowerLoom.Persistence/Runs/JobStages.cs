namespace PowerLoom.Persistence.Runs;

// `agent_run.stage` is the agent id as text (user decision 2026-10-23: any agent, also one created in the UI, records
// its runs under its own id); the two jobs that record runs too use these.
public static class JobStages
{
    public const string Sync = "sync";

    public const string PullRequests = "pull-requests";
}
