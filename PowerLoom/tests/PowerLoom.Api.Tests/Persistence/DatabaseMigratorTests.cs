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

            // The baseline is marked, every later migration (data_access, …) is run.
            Assert.Equal(db.Database.GetMigrations().Count(), applied.Count());
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

    // Tables the migrations after the baseline add: drizzle never built them, so they go before the pretence.
    private static readonly string[] PostBaselineDrops = ["DROP TABLE IF EXISTS data_access", "DROP TABLE IF EXISTS test_case", "ALTER TABLE refinement DROP COLUMN IF EXISTS details", "ALTER TABLE task_schedule DROP COLUMN IF EXISTS task_type",
        "ALTER TABLE work_item DROP COLUMN IF EXISTS discussion_md", "ALTER TABLE work_item DROP COLUMN IF EXISTS discussion_rev",
        "ALTER TABLE refinement DROP COLUMN IF EXISTS est_hours", "ALTER TABLE refinement DROP COLUMN IF EXISTS estimate_basis",
        "ALTER TABLE work_item DROP COLUMN IF EXISTS extra_fields_md", "ALTER TABLE work_item DROP COLUMN IF EXISTS attached_files",
        "ALTER TABLE work_item DROP COLUMN IF EXISTS closed_by_user",
        "ALTER TABLE code_review DROP COLUMN IF EXISTS details", "ALTER TABLE code_review DROP COLUMN IF EXISTS seen_comments", "ALTER TABLE review_comment DROP COLUMN IF EXISTS category",
        "DROP TABLE IF EXISTS pbi_estimate",
        "DROP INDEX IF EXISTS agent_run_item_idx", "ALTER TABLE agent_run DROP COLUMN IF EXISTS continues_run_id", "ALTER TABLE agent_run DROP COLUMN IF EXISTS conversation_id",
        "ALTER TABLE local_item DROP COLUMN IF EXISTS start_over"];

    // The schema exists (the fixture migrated it) but EF's history is gone and drizzle's journal is there instead; the
    // schema is brought back to the baseline's state, as drizzle left it.
    private static async Task PretendDrizzleBuiltTheSchemaAsync(PowerLoomDbContext db, int drizzleMigrations)
    {
        foreach (var drop in PostBaselineDrops)
            await db.Database.ExecuteSqlRawAsync(drop);

        await db.Database.ExecuteSqlRawAsync("DROP TABLE \"__EFMigrationsHistory\"");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA drizzle");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)");
        await db.Database.ExecuteSqlAsync($"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) SELECT 'h' || n, n FROM generate_series(1, {drizzleMigrations}) AS n");
    }
}
