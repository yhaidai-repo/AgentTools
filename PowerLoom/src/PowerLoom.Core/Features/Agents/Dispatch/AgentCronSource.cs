using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Agents.Dispatch;

// Every enabled agent's schedule from AgentConfig, read fresh on every tick: saving an agent's Config is enough.
public sealed class AgentCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var agents = await scope.ServiceProvider.GetRequiredService<AgentConfigReader>().ListAsync(cancellation);

        return agents.Where(agent => agent.Enabled && !string.IsNullOrWhiteSpace(agent.Schedule))
            .Select(agent => new CronEntry($"agent:{agent.Id}", agent.Schedule!, new DispatchAgent(agent.Id)))
            .ToList();
    }
}
