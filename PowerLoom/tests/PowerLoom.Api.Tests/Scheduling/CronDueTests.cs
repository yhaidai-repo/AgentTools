using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Api.Tests.Scheduling;

public sealed class CronDueTests
{
    private static readonly DateTimeOffset TenPast = new(2026, 1, 1, 10, 10, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("* * * * *", true)]
    [InlineData("*/5 * * * *", true)]
    [InlineData("10 10 * * *", true)]
    [InlineData("*/3 * * * *", false)]
    [InlineData("30 * * * *", false)]
    [InlineData("not a cron", false)]
    public void Due_when_the_minute_is_an_occurrence(string cron, bool due)
    {
        Assert.Equal(due, CronDue.IsDue(cron, TenPast));
    }

    [Fact]
    public void A_minute_drops_seconds_and_keeps_utc()
    {
        var local = new DateTimeOffset(2026, 1, 1, 12, 10, 45, TimeSpan.FromHours(2));

        Assert.Equal(TenPast, CronDue.MinuteOf(local));
    }
}
