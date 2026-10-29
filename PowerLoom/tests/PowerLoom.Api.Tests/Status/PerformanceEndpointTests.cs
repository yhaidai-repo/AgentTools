using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Status.Performance;

namespace PowerLoom.Api.Tests.Status;

[Collection(PowerLoomCollection.Name)]
public sealed class PerformanceEndpointTests(PowerLoomHost host)
{
    [Fact]
    public async Task Endpoint_ReturnsStoredMeasurementsAndGaps()
    {
        using var scope = host.Host.Services.CreateScope();
        var now = DateTime.UtcNow;
        var at = PerformanceAccumulator.MinuteOf(now.AddMinutes(-10));
        await scope.ServiceProvider.GetRequiredService<PerformanceStore>().SaveAsync([
            new(at, Guid.NewGuid(), 6, 120, 123456789, 1)
        ], now, default);
        var history = await host.Host.GetAsJson<PerformanceHistory>("/api/status/performance");
        Assert.NotNull(history);
        Assert.Equal(300, history.IntervalSeconds);
        var point = Assert.Single(history.Points, point => point.WorkingSetBytes == 123456789);
        Assert.Equal(6, point.RequestsPerMinute);
        Assert.Equal(20, point.AverageLatencyMs);
        Assert.Contains(history.Points, point => point.ObservedMinutes == 0 && point.RequestsPerMinute is null);
    }
}
