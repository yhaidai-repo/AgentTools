using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Flows.Engine;

// Every running execution, read fresh on every tick, advanced every minute: the hooks (a run's callback, a person's
// close) advance at once; the tick picks up what they missed.
public sealed class FlowCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public const string Cron = "* * * * *";

    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var running = await db.FlowExecutions.AsNoTracking().Where(execution => execution.Status == FlowStatuses.Running).OrderBy(execution => execution.Id).Select(execution => execution.Id).ToListAsync(cancellation);

        return running.Select(id => new CronEntry($"flow:{id}", Cron, new AdvanceFlowExecution(id))).ToList();
    }
}
