using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.AdoIntegration.Features.Settings.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.AdoIntegration.Features.Settings;

// Each feature section's switch is saved with that feature's settings (user decision 2026-10-06). The ScheduleTicker
// reads the crons from here: saving is enough, nothing is re-applied.
public static class SettingsEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/ado/pbi-sync-settings")]
    public static async Task<Results<Ok<SavedSettings>, ProblemHttpResult>> SavePbiSync(string vault, PbiSyncSettingsRequest request, AdoSettingsStore store, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var problem = SettingsProblem(request.Cron, request.MaxItemsPerRun, "Max PBIs per sync");

        if (problem is not null)
            return problem.ToProblemResult();

        await store.SaveSyncAsync(vault, new SyncSettings { Cron = request.Cron.Trim(), MaxItemsPerRun = request.MaxItemsPerRun, Sprint = string.IsNullOrWhiteSpace(request.Sprint) ? "current" : request.Sprint.Trim() }, cancellation);
        await VaultFeatures.SetAsync(db, vault, VaultFeatures.AdoSync, request.Enabled, cancellation);

        return TypedResults.Ok(new SavedSettings(request.Enabled));
    }

    [WolverinePut("/api/vaults/{vault}/ado/pull-request-settings")]
    public static async Task<Results<Ok<SavedSettings>, ProblemHttpResult>> SavePullRequests(string vault, PullRequestSettingsRequest request, AdoSettingsStore store, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var problem = SettingsProblem(request.Cron, request.MaxPullRequestsPerRun, "Max PRs per check");

        if (problem is not null)
            return problem.ToProblemResult();

        var repos = (request.Repos ?? []).Select(repo => repo.Trim()).Where(repo => repo.Length > 0).ToList();

        await store.SavePullRequestsAsync(vault, new PullRequestSettings { Cron = request.Cron.Trim(), MaxPullRequestsPerRun = request.MaxPullRequestsPerRun, Repos = repos }, cancellation);
        await VaultFeatures.SetAsync(db, vault, VaultFeatures.PullRequests, request.Enabled, cancellation);

        return TypedResults.Ok(new SavedSettings(request.Enabled));
    }

    private static Problem? SettingsProblem(string cron, int max, string maxLabel)
    {
        if (max < 1)
            return Problem.Invalid($"{maxLabel} must be a whole number above 0.");

        return CronDue.IsValid(cron.Trim()) ? null : Problem.Invalid($"\"{cron}\" isn't a cron expression (five fields, e.g. */30 * * * *).");
    }
}
