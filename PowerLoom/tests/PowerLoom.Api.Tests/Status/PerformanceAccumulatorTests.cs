using Microsoft.AspNetCore.Http;
using PowerLoom.Features.Status.Performance;

namespace PowerLoom.Api.Tests.Status;

public sealed class PerformanceAccumulatorTests
{
    [Fact]
    public void Snapshot_ConcurrentRequestsAndAnOlderAcknowledgement_PreservesNewTotals()
    {
        var clock = new Clock();
        var accumulator = new PerformanceAccumulator(clock);
        Parallel.For(0, 10000, _ => accumulator.Record(2));
        var before = accumulator.Snapshot(100);
        accumulator.Record(7);
        accumulator.Acknowledge(before);

        var after = Assert.Single(accumulator.Snapshot(200));
        Assert.Equal(10001, after.Requests);
        Assert.Equal(20007, after.DurationMs);
        Assert.Equal(200, after.WorkingSetBytes);
        Assert.Equal(before[0].InstanceId, after.InstanceId);
    }

    [Fact]
    public void Snapshot_RetryAndRollover_KeepsUnsavedTotalsAndRemovesSavedMinutes()
    {
        var clock = new Clock();
        var accumulator = new PerformanceAccumulator(clock);
        accumulator.Record(10);
        var first = Assert.Single(accumulator.Snapshot(100));
        clock.Now = clock.Now.AddMinutes(1);
        var retry = accumulator.Snapshot(110);
        Assert.Equal(first, retry.Single(sample => sample.Minute == first.Minute));
        accumulator.Acknowledge(retry);
        clock.Now = clock.Now.AddMinutes(1);

        var current = Assert.Single(accumulator.Snapshot(120));
        Assert.Equal(0, current.Requests);
        Assert.Equal(clock.Now.UtcDateTime, current.Minute);
    }

    [Fact]
    public void Snapshot_DatabaseDownForOverADay_BoundsTheRetryBuffer()
    {
        var clock = new Clock();
        var accumulator = new PerformanceAccumulator(clock);
        for (var minute = 0; minute < 1500; minute++)
        {
            accumulator.Record(1);
            clock.Now = clock.Now.AddMinutes(1);
        }
        var samples = accumulator.Snapshot(100);
        Assert.Equal(1441, samples.Count);
        Assert.All(samples, sample => Assert.True(sample.Minute >= clock.Now.AddHours(-24).UtcDateTime));
    }

    [Fact]
    public async Task Middleware_FailedRequest_IsStillCounted()
    {
        var accumulator = new PerformanceAccumulator(new Clock());
        var middleware = new PerformanceMiddleware(_ => throw new InvalidOperationException("probe"), accumulator);
        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(new DefaultHttpContext()));
        var sample = Assert.Single(accumulator.Snapshot(100));
        Assert.Equal(1, sample.Requests);
        Assert.True(sample.DurationMs >= 0);
    }

    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2030, 1, 1, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
