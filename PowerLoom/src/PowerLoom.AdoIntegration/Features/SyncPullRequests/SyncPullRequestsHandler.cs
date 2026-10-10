using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Runs;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// Recorded as a pull-requests run (the Runs page); a failure keeps the run with its error and lets Wolverine retry.
public static class SyncPullRequestsHandler
{
    public static async Task Handle(SyncPullRequests message, AdoSettingsStore settings, IAdoClientFactory clients, PowerLoomDbContext db, PullRequestSync sync, ILogger<SyncPullRequests> logger, CancellationToken cancellation)
    {
        var runId = await JobRuns.StartAsync(db, Stage.PullRequests, cancellation);

        try
        {
            var ado = await settings.ReadAdoAsync(message.Vault, cancellation);

            if (ado is null || !ado.IsConfigured)
            {
                await JobRuns.FinishAsync(db, runId, RunOutcome.NoOp, $"ADO settings are not configured for {message.Vault}", cancellation);

                return;
            }

            var client = clients.For(new AdoConnection(ado.OrgUrl, ado.Project, ado.Team, ado.Pat));
            var summary = await sync.RunAsync(message.Vault, ado, await settings.ReadPullRequestsAsync(message.Vault, cancellation), client, cancellation);

            await JobRuns.FinishAsync(db, runId, RunOutcome.Success, null, cancellation);
            logger.LogInformation("pull-requests {Vault}: {Summary}", message.Vault, summary);
        }
        catch (Exception error)
        {
            await JobRuns.FinishAsync(db, runId, RunOutcome.Failed, error.Message, cancellation);
            throw;
        }
    }
}
