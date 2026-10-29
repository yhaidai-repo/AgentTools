namespace PowerLoom.Features.Status.Performance;

// Only totals: no URLs, payloads or per-request records. Snapshots are absolute, so retries cannot count twice.
public sealed class PerformanceAccumulator(TimeProvider clock)
{
    private readonly object gate = new();
    private readonly Dictionary<DateTime, Bucket> buckets = [];
    private readonly Guid instanceId = Guid.NewGuid();
    public static DateTime MinuteOf(DateTime at) => new(at.Ticks - at.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);

    public void Record(double milliseconds)
    {
        if (!double.IsFinite(milliseconds) || milliseconds < 0) return;
        lock (gate)
        {
            var minute = MinuteOf(clock.GetUtcNow().UtcDateTime);
            var bucket = Get(minute);
            bucket.Requests++;
            bucket.DurationMs += milliseconds;
            bucket.Version++;
            Trim(minute);
        }
    }

    public IReadOnlyList<PerformanceSample> Snapshot(long workingSetBytes)
    {
        lock (gate)
        {
            var minute = MinuteOf(clock.GetUtcNow().UtcDateTime);
            Trim(minute);
            var current = Get(minute);
            current.WorkingSetBytes = Math.Max(current.WorkingSetBytes ?? 0, workingSetBytes);
            current.Version++;
            return buckets.Where(pair => pair.Value.Version != pair.Value.SavedVersion)
                .Select(pair => new PerformanceSample(pair.Key, instanceId, pair.Value.Requests, pair.Value.DurationMs, pair.Value.WorkingSetBytes, pair.Value.Version)).ToList();
        }
    }

    public void Acknowledge(IEnumerable<PerformanceSample> samples)
    {
        lock (gate)
            foreach (var sample in samples)
                if (buckets.TryGetValue(sample.Minute, out var bucket)) bucket.SavedVersion = Math.Max(bucket.SavedVersion, sample.Version);
    }

    private Bucket Get(DateTime minute)
    {
        if (!buckets.TryGetValue(minute, out var bucket)) buckets[minute] = bucket = new Bucket();
        return bucket;
    }

    private void Trim(DateTime minute)
    {
        foreach (var key in buckets.Where(pair => pair.Key < minute.AddHours(-24) || (pair.Key < minute && pair.Value.Version == pair.Value.SavedVersion)).Select(pair => pair.Key).ToList())
            buckets.Remove(key);
    }

    private sealed class Bucket
    {
        public long Requests;
        public double DurationMs;
        public long? WorkingSetBytes;
        public long Version;
        public long SavedVersion;
    }
}
