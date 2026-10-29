namespace PowerLoom.Features.Status.Performance;

public sealed record PerformanceSample(DateTime Minute, Guid InstanceId, long Requests, double DurationMs, long? WorkingSetBytes, long Version);
public sealed record PerformancePoint(DateTime At, double? RequestsPerMinute, double? AverageLatencyMs, long? WorkingSetBytes, int ObservedMinutes);
public sealed record PerformanceHistory(DateTime From, DateTime To, int IntervalSeconds, IReadOnlyList<PerformancePoint> Points);
public sealed record PerformanceAggregate(DateTime At, long Requests, double DurationMs, long? WorkingSetBytes, long ObservedMinutes);
