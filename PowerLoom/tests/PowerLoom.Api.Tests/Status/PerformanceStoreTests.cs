using Microsoft.EntityFrameworkCore;
using Npgsql;
using PowerLoom.Features.Status.Performance;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Status;

[Collection(PowerLoomCollection.Name)]
public sealed class PerformanceStoreTests : IAsyncLifetime
{
    private readonly string database = "performance_" + Guid.NewGuid().ToString("N");
    private string connection = null!;
    private static readonly DateTime Now = new(2030, 1, 2, 12, 5, 0, DateTimeKind.Utc);

    public async Task InitializeAsync()
    {
        var fixture = Environment.GetEnvironmentVariable("ConnectionStrings__PowerLoom")!;
        await ExecuteOnFixture($"CREATE DATABASE \"{database}\"");
        connection = new NpgsqlConnectionStringBuilder(fixture) { Database = database }.ConnectionString;
        await using var db = Open();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await ExecuteOnFixture($"DROP DATABASE \"{database}\" WITH (FORCE)");

    [Fact]
    public async Task SaveAsync_RetriesAndStaleSnapshots_DoNotDoubleCountOrOverwriteNewerTotals()
    {
        await using var db = Open();
        var store = new PerformanceStore(db);
        var sample = new PerformanceSample(Now.AddMinutes(-1), Guid.NewGuid(), 4, 80, 100, 1);
        await store.SaveAsync([sample], Now, default);
        await store.SaveAsync([sample with { Requests = 6, DurationMs = 180, WorkingSetBytes = 200, Version = 2 }], Now, default);
        await store.SaveAsync([sample], Now, default);

        // A new context models the API restarting; the stored history remains.
        await using var restarted = Open();
        var point = (await new PerformanceStore(restarted).ReadAsync(Now, default)).Points.Single(point => point.ObservedMinutes > 0);
        Assert.Equal(6, point.RequestsPerMinute);
        Assert.Equal(30, point.AverageLatencyMs);
        Assert.Equal(200, point.WorkingSetBytes);
    }

    [Fact]
    public async Task ReadAsync_InstancesAndIdleMinutes_UsesDistinctMinutesAndWeightedLatency()
    {
        await using var db = Open();
        var store = new PerformanceStore(db);
        var one = Guid.NewGuid();
        await store.SaveAsync([
            new(Now.AddMinutes(-5), one, 2, 20, 100, 1),
            new(Now.AddMinutes(-5), Guid.NewGuid(), 1, 100, 200, 1),
            new(Now.AddMinutes(-4), one, 0, 0, 150, 1),
            new(Now.AddMinutes(-10), one, 0, 0, 90, 1)
        ], Now, default);

        var history = await store.ReadAsync(Now, default);
        Assert.Equal(288, history.Points.Count);
        var busy = history.Points[^1];
        Assert.Equal(2, busy.ObservedMinutes);
        Assert.Equal(1.5, busy.RequestsPerMinute);
        Assert.Equal(40, busy.AverageLatencyMs);
        Assert.Equal(200, busy.WorkingSetBytes);
        var idle = history.Points[^2];
        Assert.Equal(0, idle.RequestsPerMinute);
        Assert.Null(idle.AverageLatencyMs);
        Assert.Null(history.Points[0].RequestsPerMinute);
        Assert.Null(history.Points[0].WorkingSetBytes);
    }

    [Fact]
    public async Task SaveAsync_OldAndCurrentMinutes_PrunesExpiredHistoryAndHidesUnfinishedMinute()
    {
        await using var db = Open();
        var store = new PerformanceStore(db);
        var id = Guid.NewGuid();
        await store.SaveAsync([
            new(Now.AddHours(-24).AddMinutes(-1), id, 99, 99, 99, 1),
            new(Now.AddHours(-24), id, 2, 20, 100, 1),
            new(Now, id, 100, 100, 100, 1)
        ], Now.AddSeconds(30), default);
        var history = await store.ReadAsync(Now.AddSeconds(30), default);
        Assert.Equal(2, history.Points[0].RequestsPerMinute);
        Assert.Single(history.Points, point => point.ObservedMinutes > 0);
        Assert.Equal(2, await db.Database.SqlQueryRaw<int>("SELECT COUNT(*)::int AS \"Value\" FROM application_metric_sample").SingleAsync());
    }

    private PowerLoomDbContext Open() => new(new DbContextOptionsBuilder<PowerLoomDbContext>()
        .UseNpgsql(connection, options => options.MapPowerLoomEnums()).Options);

    private async Task ExecuteOnFixture(string sql)
    {
        await using var fixture = new NpgsqlConnection(Environment.GetEnvironmentVariable("ConnectionStrings__PowerLoom"));
        await fixture.OpenAsync();
        await using var command = new NpgsqlCommand(sql, fixture);
        await command.ExecuteNonQueryAsync();
    }
}
