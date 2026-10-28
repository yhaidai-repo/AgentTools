using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Persistence;

[Collection(PowerLoomCollection.Name)]
public sealed class ImplementationSnapshotMigrationTests(PowerLoomHost host)
{
    private const int Pbi = 69102;

    [Fact]
    public async Task An_implementation_version_of_inspect_schema_1_is_stored_with_its_plan_version()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await SeedPbiAsync(db);
        await InsertSnapshotAsync(db, version: 1, schemaVersion: 1);

        var planVersion = await db.Database.SqlQueryRaw<int>("SELECT plan_version AS \"Value\" FROM implementation_snapshot WHERE pbi_id = {0}", Pbi).SingleAsync();

        Assert.Equal(3, planVersion);
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
    public async Task A_pbi_has_one_implementation_per_version()
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

    [Fact]
    public async Task A_plan_keeps_the_pbi_content_hash_it_was_made_from()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await SeedPbiAsync(db);
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO planning_snapshot (pbi_id, version, schema_version, inspect, plan, pbi_content_hash) VALUES ({0}, 1, 1, '{{}}'::jsonb, '{{}}'::jsonb, 'h1')",
            Pbi);

        var hash = await db.Database.SqlQueryRaw<string>("SELECT pbi_content_hash AS \"Value\" FROM planning_snapshot WHERE pbi_id = {0}", Pbi).SingleAsync();

        Assert.Equal("h1", hash);
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
            "INSERT INTO implementation_snapshot (pbi_id, version, schema_version, inspect, build, plan_version) VALUES ({0}, {1}, {2}, '{{}}'::jsonb, '{{}}'::jsonb, 3)",
            Pbi, version, schemaVersion);
    }
}
