using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Features.SyncRepositories;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Runs;
using Wolverine;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Recorded as a sync run (the Runs page); a failure keeps the run with its error and lets Wolverine retry or dead-letter.
public static class SyncPbisHandler
{
    public static async Task Handle(SyncPbis message, AdoSettingsStore settings, IAdoClientFactory clients, PowerLoomDbContext db, SprintSync sprintSync, ImportSync importSync, SinglePbiSync singleSync, IMessageBus bus, ILogger<SyncPbis> logger, CancellationToken cancellation)
    {
        var runId = await JobRuns.StartAsync(db, Stage.Sync, cancellation);

        try
        {
            var outcome = await RunAsync(message, settings, clients, sprintSync, importSync, singleSync, runId, cancellation);

            await JobRuns.FinishAsync(db, runId, outcome.Outcome, outcome.Outcome == RunOutcome.Success ? null : outcome.Message, cancellation);
            logger.LogInformation("sync {Vault} {Outcome}: {Message}", message.Vault, outcome.Outcome, outcome.Message);

            if (outcome.Outcome == RunOutcome.Success && message.AdoId is null && message.Sources == SyncSources.Sprint)
                await bus.PublishAsync(new SyncRepositories.SyncRepositories(message.Vault));

            if (outcome.Outcome == RunOutcome.Success)
                await PrepareNewBugsAsync(db, bus, logger, cancellation);
        }
        catch (Exception error)
        {
            await JobRuns.FinishAsync(db, runId, RunOutcome.Failed, error.Message, cancellation);
            throw;
        }
    }

    // Bugs are prepared without the user (user decision 2026-10-09): a new or changed bug gets its note and refinement
    // task right after the sync that brought it (bug.report prepares its own).
    private static async Task PrepareNewBugsAsync(PowerLoomDbContext db, IMessageBus bus, ILogger<SyncPbis> logger, CancellationToken cancellation)
    {
        var bugs = await Bugs.ToPrepareAsync(db, cancellation);

        foreach (var bug in bugs)
            await bus.PublishAsync(new PreparePbi(bug.Vault, bug.AdoId, "sync"));

        if (bugs.Count > 0)
            logger.LogInformation("sync: {Count} bug(s) to prepare: {Ids}", bugs.Count, string.Join(", ", bugs.Select(bug => bug.AdoId)));
    }

    private static async Task<SyncOutcome> RunAsync(SyncPbis message, AdoSettingsStore settings, IAdoClientFactory clients, SprintSync sprintSync, ImportSync importSync, SinglePbiSync singleSync, long runId, CancellationToken cancellation)
    {
        // A PBI PowerLoom has stays in its vault; a new one joins the vault the user had selected.
        var vault = message.AdoId is { } adoId ? await singleSync.VaultOfAsync(adoId, cancellation) ?? message.Vault : message.Vault;
        var ado = await settings.ReadAdoAsync(vault, cancellation);

        if (ado is null || !ado.IsConfigured)
            return new SyncOutcome(RunOutcome.NoOp, $"ADO settings are not configured for {vault}");

        var client = clients.For(new AdoConnection(ado.OrgUrl, ado.Project, ado.Team, ado.Pat));

        if (message.AdoId is { } single)
            return await singleSync.RunAsync(vault, single, client, runId, cancellation);

        if (message.Sources == SyncSources.Imports)
            return await importSync.RunAsync(vault, ado, client, runId, cancellation);

        return await sprintSync.RunAsync(vault, ado, await settings.ReadSyncAsync(vault, cancellation), client, runId, cancellation);
    }
}
