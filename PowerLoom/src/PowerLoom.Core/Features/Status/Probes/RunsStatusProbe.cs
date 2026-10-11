using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Status.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.AgentConfig.Models;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Status.Probes;

// The agents' claimed tasks (in progress since their claim) and the last sync and pull-request check runs.
public sealed class RunsStatusProbe(PowerLoomDbContext db, AgentConfigReader agents, IOptions<RunnerOptions> options)
{
    private const int RecentSyncRuns = 10;
    private const string AgentPrefix = "agent:";

    private static readonly Stage[] SyncStages = [Stage.Sync, Stage.PullRequests];

    public async Task<List<RunInProgress>> InProgressAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        var tasks = await db.LocalItems.AsNoTracking()
            .Where(item => item.Status == ItemStatus.InProgress && item.Assignee.StartsWith(AgentPrefix))
            .OrderBy(item => item.UpdatedAt)
            .Select(item => new { item.Id, item.Assignee, item.PbiId, item.UpdatedAt })
            .ToListAsync(cancellation);
        var timeouts = (await agents.ListAsync(cancellation)).ToDictionary(agent => agent.Id, agent => agent.TimeoutMinutes);

        return tasks.Select(task => ToRun(task.Id, AgentStages.AgentIdOf(task.Assignee) ?? task.Assignee, task.PbiId, task.UpdatedAt, timeouts, now)).ToList();
    }

    public async Task<List<SyncRun>> RecentSyncsAsync(CancellationToken cancellation)
    {
        var runs = await db.AgentRuns.AsNoTracking()
            .Where(run => SyncStages.Contains(run.Stage))
            .OrderByDescending(run => run.Id)
            .Take(RecentSyncRuns)
            .Select(run => new { run.Id, run.Stage, run.Outcome, run.Error, run.StartedAt, run.EndedAt })
            .ToListAsync(cancellation);

        return runs.Select(run => new SyncRun(run.Id, run.Stage, run.Outcome, run.Error, Utc(run.StartedAt), run.EndedAt is null ? null : Utc(run.EndedAt.Value))).ToList();
    }

    private RunInProgress ToRun(string taskId, string agentId, int? pbiId, DateTime claimedAt, Dictionary<string, int> timeouts, DateTimeOffset now)
    {
        var since = Utc(claimedAt);
        var limit = TimeSpan.FromMinutes(timeouts.GetValueOrDefault(agentId, AgentSummaryDefaults.TimeoutMinutes)) + options.Value.TimeoutMargin;

        return new RunInProgress(taskId, agentId, pbiId, since, now - since > limit);
    }

    private static DateTimeOffset Utc(DateTime time) => new(DateTime.SpecifyKind(time, DateTimeKind.Utc));
}
