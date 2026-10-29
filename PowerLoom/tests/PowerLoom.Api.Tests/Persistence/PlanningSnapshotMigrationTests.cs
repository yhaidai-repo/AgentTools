using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Persistence;

[Collection(PowerLoomCollection.Name)]
public sealed class PlanningSnapshotMigrationTests(PowerLoomHost host)
{
    private const int Pbi = 69101;

    [Fact]
    public async Task A_plan_version_of_inspect_schema_1_is_stored()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await SeedPbiAsync(db);
        await InsertSnapshotAsync(db, version: 1, schemaVersion: 1);

        var stored = await db.Database.SqlQueryRaw<int>("SELECT schema_version::int AS \"Value\" FROM planning_snapshot WHERE pbi_id = {0}", Pbi).SingleAsync();

        Assert.Equal(1, stored);
        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task Another_inspect_schema_version_is_refused()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await SeedPbiAsync(db);

        var error = await Assert.ThrowsAsync<PostgresException>(() => InsertSnapshotAsync(db, version: 1, schemaVersion: 2));

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task A_pbi_has_one_snapshot_per_version()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await SeedPbiAsync(db);
        await InsertSnapshotAsync(db, version: 1, schemaVersion: 1);

        var error = await Assert.ThrowsAsync<PostgresException>(() => InsertSnapshotAsync(db, version: 1, schemaVersion: 1));

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        await transaction.RollbackAsync();
    }

    private static async Task SeedPbiAsync(PowerLoomDbContext db)
    {
        ReviewFixSeed.Pbi(db, Pbi, PowerLoomHost.Vault);

        await db.SaveChangesAsync();
    }

    private static Task<int> InsertSnapshotAsync(PowerLoomDbContext db, int version, int schemaVersion)
    {
        return db.Database.ExecuteSqlRawAsync(
            "INSERT INTO planning_snapshot (pbi_id, version, schema_version, inspect, plan) VALUES ({0}, {1}, {2}, '{{}}'::jsonb, '{{}}'::jsonb)",
            Pbi, version, schemaVersion);
    }
}
