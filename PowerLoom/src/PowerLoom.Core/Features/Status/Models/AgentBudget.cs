namespace PowerLoom.Features.Status.Models;

public sealed record AgentBudget(string AgentId, decimal DailyLimitUsd, decimal SpentTodayUsd);
