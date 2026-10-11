using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerLoom.Persistence;

namespace PowerLoom.Infrastructure.Persistence;

// PowerLoom owns the schema (user decision 2026-10-11): the migrations run before Wolverine starts. PowerLoom's existing
// database, built by drizzle, is adopted once: the baseline is recorded as applied, nothing is created again.
public sealed class DatabaseMigrator(IServiceScopeFactory scopes, ILogger<DatabaseMigrator> logger) : IHostedService
{
    // drizzle's journal when the baseline was scaffolded (migrations 0000–0040). Another count is a schema the
    // baseline doesn't describe: stop rather than guess.
    public const int DrizzleMigrationsAtBaseline = 41;

    private static readonly string[] BaselineSuffixes = ["_Baseline", "_BaselineObjects"];

    // EF's history table (mixed case: quoted for the catalog) and drizzle's journal.
    private const string HistoryTable = "\"__EFMigrationsHistory\"";
    private const string DrizzleJournal = "drizzle.__drizzle_migrations";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await MigrateAsync(db, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task MigrateAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        await AdoptDrizzleDatabaseAsync(db, cancellation);

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellation)).ToList();

        await db.Database.MigrateAsync(cancellation);
        logger.LogInformation("database: {Count} migration(s) applied{Names}", pending.Count, pending.Count == 0 ? "" : ": " + string.Join(", ", pending));
    }

    private async Task AdoptDrizzleDatabaseAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        var history = db.GetService<IHistoryRepository>();

        // Asked of the catalog, not of EF: the repository's own answer is cached across contexts.
        if (await TableExistsAsync(db, HistoryTable, cancellation))
        {
            logger.LogInformation("database: PowerLoom's migration history is present");

            return;
        }

        var drizzleMigrations = await DrizzleMigrationCountAsync(db, cancellation);

        // No journal: a new database, the migrations build it.
        if (drizzleMigrations is null)
        {
            logger.LogInformation("database: no migration history and no drizzle journal, a new database");

            return;
        }

        logger.LogInformation("database: drizzle journal with {Count} migration(s), no PowerLoom history", drizzleMigrations);

        if (drizzleMigrations != DrizzleMigrationsAtBaseline)
            throw new InvalidOperationException($"The database has {drizzleMigrations} drizzle migrations; the baseline describes {DrizzleMigrationsAtBaseline}. Bring the schema to that state first.");

        await MarkBaselineAppliedAsync(db, history, cancellation);
        logger.LogInformation("database: adopted PowerLoom's drizzle schema, the baseline is recorded as applied");
    }

    private static async Task<int?> DrizzleMigrationCountAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (!await TableExistsAsync(db, DrizzleJournal, cancellation))
            return null;

        return await db.Database.SqlQueryRaw<int>($"SELECT count(*)::int AS \"Value\" FROM {DrizzleJournal}").SingleAsync(cancellation);
    }

    private static Task<bool> TableExistsAsync(PowerLoomDbContext db, string qualifiedName, CancellationToken cancellation)
    {
        return db.Database.SqlQueryRaw<bool>("SELECT to_regclass({0}) IS NOT NULL AS \"Value\"", qualifiedName).SingleAsync(cancellation);
    }

    // The history table plus one row per baseline migration, the way EF records an applied migration.
    private static Task MarkBaselineAppliedAsync(PowerLoomDbContext db, IHistoryRepository history, CancellationToken cancellation)
    {
        var baseline = db.Database.GetMigrations().Where(id => BaselineSuffixes.Any(id.EndsWith));
        var rows = baseline.Select(id => history.GetInsertScript(new HistoryRow(id, ProductInfo.GetVersion())));
        var script = history.GetCreateScript() + string.Concat(rows);

        return db.Database.ExecuteSqlRawAsync(script, cancellation);
    }
}
