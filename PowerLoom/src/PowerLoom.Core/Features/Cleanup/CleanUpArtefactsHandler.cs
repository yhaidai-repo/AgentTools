using System.Diagnostics;
using PowerLoom.Features.Cleanup.Models;

namespace PowerLoom.Features.Cleanup;

// Runs every cleaner with the vault's settings; a failing store doesn't stop the others. The actions become
// data_access rows and the report the Status page shows.
public static class CleanUpArtefactsHandler
{
    public static async Task Handle(CleanUpArtefacts message, CleanupSettingsStore store, IEnumerable<IArtefactCleaner> cleaners, CleanupLog log, TimeProvider clock, ILogger<CleanUpArtefacts> logger, CancellationToken cancellation)
    {
        var watch = Stopwatch.StartNew();
        var context = new CleanupContext(message.Vault, await store.ReadAsync(message.Vault, cancellation), clock.GetUtcNow());
        var stores = new List<CleanupStoreReport>();
        var actions = new List<CleanupAction>();
        var errors = new List<string>();

        foreach (var cleaner in cleaners)
        {
            var result = await CleanOrFailAsync(cleaner, context, errors, logger, cancellation);

            actions.AddRange(result.Actions);
            stores.Add(ReportOf(cleaner.Store, result));
        }

        var report = new CleanupReport(context.Now, context.DryRun, stores, errors);

        await log.WriteAsync(message.Vault, context.Now, actions, (int)watch.ElapsedMilliseconds, cancellation);
        await store.SaveReportAsync(message.Vault, report, cancellation);
        logger.LogInformation("cleanup {Vault}: {Mode}, {Items} item(s), {Bytes} bytes, {Errors} error(s)", message.Vault, context.DryRun ? "dry run" : "deleted", report.Items, report.Bytes, errors.Count);
    }

    private static async Task<CleanerResult> CleanOrFailAsync(IArtefactCleaner cleaner, CleanupContext context, List<string> errors, ILogger logger, CancellationToken cancellation)
    {
        try
        {
            return await cleaner.CleanAsync(context, cancellation);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogError(error, "cleanup {Vault}: store {Store} failed", context.Vault, cleaner.Store);
            errors.Add($"{cleaner.Store}: {error.Message}");

            return CleanerResult.Skipped($"failed: {error.Message}");
        }
    }

    private static CleanupStoreReport ReportOf(string store, CleanerResult result)
    {
        var counted = result.Actions.Where(action => action.Error is null).ToList();

        return new CleanupStoreReport(store, counted.Count, counted.Sum(action => action.Bytes), result.Note);
    }
}
