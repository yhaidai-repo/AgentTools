using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;
using PowerLoom.DevHubIntegration.Settings;
using PowerLoom.Features.Cleanup;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Items;

namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts;

// A run's browser recordings on the PC (video, trace, screenshots) past the buffer; a run whose test report has a failed
// case or that reported a bug keeps them longer. DevHub lists the owners and deletes; off or silent, nothing happens
// until the next day. The test report (verdicts, cases, file names) stays in the database.
public sealed partial class BrowserArtefactsCleaner(PowerLoomDbContext db, DevHubSettingsStore settings, IDevHubBrowserArtefacts artefacts) : IArtefactCleaner
{
    public const string StoreName = "browser-artefacts";
    private const string OwnerPrefix = "powerloom-run-";

    public string Store => StoreName;

    public async Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation)
    {
        if (context.CutoffOf(context.Settings.BrowserArtefactDays) is null)
            return CleanerResult.Off;

        var devHub = await settings.ReadAsync(context.Vault, cancellation);

        if (!devHub.Enabled)
            return CleanerResult.Skipped("DevHub is off for this vault");

        var target = new DevHubTarget(devHub.Url, devHub.Token);
        var owners = await artefacts.ListOwnersAsync(target, cancellation);

        if (owners is null)
            return CleanerResult.Skipped("DevHub didn't answer; tried again tomorrow");

        return new CleanerResult(await CleanOwnersAsync(context, target, owners, cancellation));
    }

    private async Task<List<CleanupAction>> CleanOwnersAsync(CleanupContext context, DevHubTarget target, IReadOnlyList<OwnerArtefacts> owners, CancellationToken cancellation)
    {
        var actions = new List<CleanupAction>();

        foreach (var owner in owners.Where(owner => RunIdOf(owner.Owner) is not null))
        {
            var due = await IsDueAsync(context, owner, RunIdOf(owner.Owner)!.Value, cancellation);

            if (due)
                actions.Add(await DeleteAsync(context, target, owner, cancellation));
        }

        return actions;
    }

    // Due when the run (of this vault) ended before its buffer; a run PowerLoom doesn't know goes by the folder's date.
    private async Task<bool> IsDueAsync(CleanupContext context, OwnerArtefacts owner, long runId, CancellationToken cancellation)
    {
        var run = await RunOfAsync(runId, cancellation);

        if (run is null)
            return owner.ModifiedAt < context.CutoffOf(context.Settings.BrowserArtefactDays);

        if (run.Vault != context.Vault || run.EndedAt is null)
            return false;

        var days = await KeepsLongerAsync(run, cancellation) ? context.Settings.FailedRunBrowserArtefactDays : context.Settings.BrowserArtefactDays;

        return context.CutoffOf(days) is { } cutoff && run.EndedAt < cutoff.UtcDateTime;
    }

    private async Task<RecordedRun?> RunOfAsync(long runId, CancellationToken cancellation)
    {
        return await db.AgentRuns.AsNoTracking()
            .Where(run => run.Id == runId)
            .Select(run => new RecordedRun(run.Id, run.PbiId, run.StartedAt, run.EndedAt, run.Pbi != null ? run.Pbi.Vault : run.Item != null ? run.Item.Vault : ""))
            .SingleOrDefaultAsync(cancellation);
    }

    // A failed case in the run's test report, or a bug reported on the PBI while the run was at work.
    private async Task<bool> KeepsLongerAsync(RecordedRun run, CancellationToken cancellation)
    {
        var reports = await db.LocalItems.AsNoTracking().Where(item => item.CreatedByRun == run.Id && item.Kind == ItemKinds.TestReport).Select(item => item.Data).ToListAsync(cancellation);

        if (reports.Any(Domain.Pbis.TestReportData.HasFailedCase))
            return true;

        return run.PbiId is not null && await db.Bugs.AnyAsync(bug => bug.PbiId == run.PbiId && bug.CreatedAt >= run.StartedAt && bug.CreatedAt <= run.EndedAt, cancellation);
    }

    private async Task<CleanupAction> DeleteAsync(CleanupContext context, DevHubTarget target, OwnerArtefacts owner, CancellationToken cancellation)
    {
        var deleted = await artefacts.DeleteOwnerAsync(target, owner.Owner, context.DryRun, cancellation);

        if (deleted is null)
            return CleanupAction.Failed(StoreName, owner.Owner, owner.Bytes, "DevHub didn't answer");

        return context.DryRun ? CleanupAction.Planned(StoreName, owner.Owner, deleted.Bytes) : CleanupAction.Removed(StoreName, owner.Owner, deleted.Bytes);
    }

    private static long? RunIdOf(string owner)
    {
        var match = RunOwner().Match(owner);

        return match.Success ? long.Parse(match.Groups[1].Value) : null;
    }

    [GeneratedRegex($"^{OwnerPrefix}([0-9]+)$")]
    private static partial Regex RunOwner();
}
