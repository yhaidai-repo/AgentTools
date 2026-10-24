namespace PowerLoom.Infrastructure.Scheduling;

// One cron line: on every minute `Cron` matches, `Message` is published. `Key` names it in logs and dashboards.
public sealed record CronEntry(string Key, string Cron, object Message);
