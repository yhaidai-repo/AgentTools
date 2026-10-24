namespace PowerLoom.Infrastructure.AgentConfig.Models;

// The module's global switches: the kill switch, the pause after a provider rate limit, the daily cap.
public sealed record AgentsGlobal(bool Paused, DateTimeOffset? PausedUntil, decimal DailyBudgetUsd)
{
    public bool IsPaused(DateTimeOffset now) => Paused || (PausedUntil is not null && PausedUntil > now);
}
