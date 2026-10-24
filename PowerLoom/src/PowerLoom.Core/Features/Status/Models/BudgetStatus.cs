namespace PowerLoom.Features.Status.Models;

// Today's spend (UTC day) against the global and the per-agent daily budgets from AgentConfig.
public sealed record BudgetStatus(decimal DailyLimitUsd, decimal SpentTodayUsd, List<AgentBudget> Agents);
