namespace PowerLoom.Infrastructure.AgentConfig.Models;

// What an agent definition means when it leaves a value out (the AgentConfig module's code defaults).
public static class AgentSummaryDefaults
{
    public const int TimeoutMinutes = 60;
    public const int BatchSize = 1;
    public const decimal DailyBudgetUsd = 0;
}
