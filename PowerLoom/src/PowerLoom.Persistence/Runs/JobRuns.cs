using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Runs;

// Jobs record their runs in `agent_run` too (the ADO sync, the pull request check): no agent's, so the agent run lists
// and counts leave them out.
public static class JobRuns
{
    public static async Task<long> StartAsync(PowerLoomDbContext db, Stage stage, CancellationToken cancellation)
    {
        var run = new AgentRun { Stage = stage };

        db.AgentRuns.Add(run);
        await db.SaveChangesAsync(cancellation);

        return run.Id;
    }

    public static async Task FinishAsync(PowerLoomDbContext db, long runId, RunOutcome outcome, string? error, CancellationToken cancellation)
    {
        var run = await db.AgentRuns.FindAsync([runId], cancellation) ?? throw new InvalidOperationException($"run {runId} isn't in adoa");

        run.Outcome = outcome;
        run.Error = error;
        run.EndedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }
}
