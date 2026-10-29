using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status.Performance;

public sealed class PerformanceStore(PowerLoomDbContext db)
{
    public async Task SaveAsync(IReadOnlyList<PerformanceSample> samples, DateTime now, CancellationToken cancellation)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        foreach (var sample in samples)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO application_metric_sample (minute, instance_id, requests, duration_ms, working_set_bytes)
                VALUES ({sample.Minute}, {sample.InstanceId}, {sample.Requests}, {sample.DurationMs}, {sample.WorkingSetBytes})
                ON CONFLICT (minute, instance_id) DO UPDATE SET
                    requests = GREATEST(application_metric_sample.requests, excluded.requests),
                    duration_ms = GREATEST(application_metric_sample.duration_ms, excluded.duration_ms),
                    working_set_bytes = GREATEST(application_metric_sample.working_set_bytes, excluded.working_set_bytes)
                """, cancellation);
        }
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM application_metric_sample WHERE minute < {PerformanceAccumulator.MinuteOf(now).AddHours(-24)}", cancellation);
        await transaction.CommitAsync(cancellation);
    }

    public async Task<PerformanceHistory> ReadAsync(DateTime now, CancellationToken cancellation)
    {
        var to = PerformanceAccumulator.MinuteOf(now);
        var from = to.AddHours(-24);
        var aggregates = await db.Database.SqlQuery<PerformanceAggregate>($"""
            SELECT date_bin('5 minutes', minute, '1970-01-01 00:00:00+00'::timestamptz) AS "At",
                   SUM(requests)::bigint AS "Requests", SUM(duration_ms) AS "DurationMs",
                   MAX(working_set_bytes) AS "WorkingSetBytes", COUNT(DISTINCT minute) AS "ObservedMinutes"
            FROM application_metric_sample WHERE minute >= {from} AND minute < {to}
            GROUP BY 1 ORDER BY 1
            """).ToListAsync(cancellation);
        var byTime = aggregates.ToDictionary(row => row.At);
        var points = new List<PerformancePoint>();
        var step = TimeSpan.FromMinutes(5);
        for (var at = new DateTime(from.Ticks - from.Ticks % step.Ticks, DateTimeKind.Utc); at < to; at += step)
        {
            byTime.TryGetValue(at, out var row);
            points.Add(new PerformancePoint(at,
                row is null ? null : row.Requests / (double)row.ObservedMinutes,
                row is null || row.Requests == 0 ? null : row.DurationMs / row.Requests,
                row?.WorkingSetBytes, (int)(row?.ObservedMinutes ?? 0)));
        }
        return new PerformanceHistory(from, to, (int)step.TotalSeconds, points);
    }
}
