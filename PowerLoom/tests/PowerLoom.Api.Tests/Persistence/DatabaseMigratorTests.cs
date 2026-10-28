using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using PowerLoom.Infrastructure.Persistence;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Persistence;

// The pretence strips a schema back to the baseline, so it runs on a database of its own on the fixture's Postgres: the
// collection's database, which every other test shares, is never touched.
[Collection(PowerLoomCollection.Name)]
public sealed class DatabaseMigratorTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string BaselineSuffix = "_BaselineObjects";

    private readonly string _database = "migrator_" + Guid.NewGuid().ToString("N");
    private readonly string _fixtureConnection = Environment.GetEnvironmentVariable("ConnectionStrings__PowerLoom")!;
    private string _connection = null!;

    public async Task InitializeAsync()
    {
        _connection = new NpgsqlConnectionStringBuilder(_fixtureConnection) { Database = _database }.ConnectionString;

        await RunOnFixtureDatabaseAsync("CREATE DATABASE " + QuotedDatabase());

        await using var db = OpenContext(_connection);
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();

        await RunOnFixtureDatabaseAsync("DROP DATABASE " + QuotedDatabase() + " WITH (FORCE)");
    }

    // Plain Npgsql: CREATE/DROP DATABASE run outside any transaction, and the name is this class's own, never input.
    private async Task RunOnFixtureDatabaseAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_fixtureConnection);
        await connection.OpenAsync();

        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private string QuotedDatabase()
    {
        return "\"" + _database + "\"";
    }

    [Fact]
    public async Task Adoa_s_drizzle_database_is_adopted_without_running_the_baseline()
    {
        await using var db = OpenContext(_connection);

        await PretendDrizzleBuiltTheSchemaAsync(db, DatabaseMigrator.DrizzleMigrationsAtBaseline);
        await Migrator().MigrateAsync(db, CancellationToken.None);

        var applied = await db.Database.GetAppliedMigrationsAsync();

        // The baseline is marked, every later migration (data_access, …) is run.
        Assert.Equal(db.Database.GetMigrations().Count(), applied.Count());
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }

    [Fact]
    public async Task A_drizzle_schema_the_baseline_does_not_describe_is_refused()
    {
        await using var db = OpenContext(_connection);

        await PretendDrizzleBuiltTheSchemaAsync(db, DatabaseMigrator.DrizzleMigrationsAtBaseline - 1);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Migrator().MigrateAsync(db, CancellationToken.None));
    }

    private DatabaseMigrator Migrator()
    {
        return host.Host.Services.GetRequiredService<DatabaseMigrator>();
    }

    private static PowerLoomDbContext OpenContext(string connection)
    {
        var options = new DbContextOptionsBuilder<PowerLoomDbContext>().UseNpgsql(connection, npgsql => npgsql.MapPowerLoomEnums()).Options;

        return new PowerLoomDbContext(options);
    }

    // The schema exists (migrated above) but EF's history is gone and drizzle's journal is there instead; the schema is
    // brought back to the baseline's state, as drizzle left it. The migrations undo what they added, so a new migration
    // never needs a drop here.
    private static async Task PretendDrizzleBuiltTheSchemaAsync(PowerLoomDbContext db, int drizzleMigrations)
    {
        await db.GetService<IMigrator>().MigrateAsync(BaselineMigrationOf(db));

        await db.Database.ExecuteSqlRawAsync("DROP TABLE \"__EFMigrationsHistory\"");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA drizzle");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)");
        await db.Database.ExecuteSqlAsync($"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) SELECT 'h' || n, n FROM generate_series(1, {drizzleMigrations}) AS n");
    }

    private static string BaselineMigrationOf(PowerLoomDbContext db)
    {
        return db.Database.GetMigrations().Single(id => id.EndsWith(BaselineSuffix, StringComparison.Ordinal));
    }
}
