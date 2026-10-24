using Microsoft.EntityFrameworkCore;
using Npgsql;
using PowerLoom.Features.Status.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status.Probes;

// Today's spend from the AgentUsage module's table (`agent_usage.usage_record`, labels.agent names the agent) against
// the budgets in AgentConfig. The table belongs to the runner's module: missing until its first start.
public sealed class BudgetStatusProbe(PowerLoomDbContext db, AgentConfigReader agents)
{
    private const string UndefinedTable = "42P01";

    public async Task<BudgetStatus> ReadAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        var dayStart = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var spent = await SpentTodayAsync(dayStart, cancellation);
        var global = await agents.GlobalAsync(cancellation);
        var perAgent = (await agents.ListAsync(cancellation)).Select(agent => new AgentBudget(agent.Id, agent.DailyBudgetUsd, spent.GetValueOrDefault(agent.Id))).ToList();

        return new BudgetStatus(global.DailyBudgetUsd, spent.Values.Sum(), perAgent);
    }

    private async Task<Dictionary<string, decimal>> SpentTodayAsync(DateTimeOffset dayStart, CancellationToken cancellation)
    {
        try
        {
            var rows = await db.Database.SqlQuery<AgentSpend>($"select coalesce(labels->>'agent', '') as \"Agent\", coalesce(sum(cost_usd), 0) as \"Spent\" from agent_usage.usage_record where started_at >= {dayStart} group by 1").ToListAsync(cancellation);

            return rows.ToDictionary(row => row.Agent, row => row.Spent);
        }
        catch (PostgresException error) when (error.SqlState == UndefinedTable)
        {
            return [];
        }
    }

    private sealed record AgentSpend(string Agent, decimal Spent);
}
