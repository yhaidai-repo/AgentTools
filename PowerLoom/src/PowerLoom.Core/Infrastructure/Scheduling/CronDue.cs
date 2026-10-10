using Cronos;

namespace PowerLoom.Infrastructure.Scheduling;

// Five-field cron, UTC, minute resolution (what pg-boss ran until now).
public static class CronDue
{
    public static bool IsValid(string cron) => TryParse(cron, out _);

    // Due when the minute is an occurrence of the expression. A tick never catches up on missed minutes.
    public static bool IsDue(string cron, DateTimeOffset minute)
    {
        if (!TryParse(cron, out var expression))
            return false;

        var at = minute.UtcDateTime;

        return expression.GetNextOccurrence(at, inclusive: true) == at;
    }

    public static DateTimeOffset MinuteOf(DateTimeOffset time)
    {
        var utc = time.UtcDateTime;

        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute, 0, TimeSpan.Zero);
    }

    private static bool TryParse(string cron, out CronExpression expression)
    {
        try
        {
            expression = CronExpression.Parse(cron);

            return true;
        }
        catch (CronFormatException)
        {
            expression = null!;

            return false;
        }
    }
}
