using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Infrastructure.Persistence;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Persistence;

[Collection(PowerLoomCollection.Name)]
public sealed class DatabaseMigratorTests(PowerLoomHost host)
{
    [Fact]
    public async Task Adoa_s_drizzle_database_is_adopted_without_running_the_baseline()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await PretendDrizzleBuiltTheSchemaAsync(db, DatabaseMigrator.DrizzleMigrationsAtBaseline);

        try
        {
            await host.Host.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(db, CancellationToken.None);

            var applied = await db.Database.GetAppliedMigrationsAsync();

            Assert.Equal(2, applied.Count());
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("DROP SCHEMA drizzle CASCADE");
        }
    }

    [Fact]
    public async Task A_drizzle_schema_the_baseline_does_not_describe_is_refused()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await PretendDrizzleBuiltTheSchemaAsync(db, DatabaseMigrator.DrizzleMigrationsAtBaseline - 1);

        try
        {
            var migrator = host.Host.Services.GetRequiredService<DatabaseMigrator>();

            await Assert.ThrowsAsync<InvalidOperationException>(() => migrator.MigrateAsync(db, CancellationToken.None));
        }
        finally
        {
            // Back to an adopted state for the other tests: the journal at the baseline count, then adoption.
            await db.Database.ExecuteSqlRawAsync("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('h41', 41)");
            await host.Host.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(db, CancellationToken.None);
            await db.Database.ExecuteSqlRawAsync("DROP SCHEMA drizzle CASCADE");
        }
    }

    // The schema exists (the fixture migrated it) but EF's history is gone and drizzle's journal is there instead.
    private static async Task PretendDrizzleBuiltTheSchemaAsync(PowerLoomDbContext db, int drizzleMigrations)
    {
        await db.Database.ExecuteSqlRawAsync("DROP TABLE \"__EFMigrationsHistory\"");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA drizzle");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)");
        await db.Database.ExecuteSqlAsync($"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) SELECT 'h' || n, n FROM generate_series(1, {drizzleMigrations}) AS n");
    }
}
