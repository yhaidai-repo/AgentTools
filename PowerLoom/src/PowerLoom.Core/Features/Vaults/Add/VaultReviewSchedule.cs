using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Vaults.Add;

// Every vault is reviewed on a schedule (user decision 2026-10-24: a fresh install reviews its vaults as this PC does):
// the schedule the Tasks page would save, every 6 hours. A vault that has one (a restored vault) keeps it as it is.
public sealed class VaultReviewSchedule(PowerLoomDbContext db, TaskScheduling scheduling)
{
    private const string TaskType = "vault-review";
    private const string Name = "Vault review schedule";
    private const string Cron = "0 */6 * * *";
    private const string Description = "Review the vault: decide each stale or unlinked note, fix invalid links, and close or keep each open WWW/KI/OQ record.";
    private const string AcceptanceCriteria = "Each candidate taken this run has a decision with its reasons; the summary lists what changed and what is left.";

    public async Task EnsureAsync(string vault, CancellationToken cancellation)
    {
        if (await HasOneAsync(vault, cancellation))
            return;

        var saved = await scheduling.SaveAsync(new ScheduleInput(null, Name, vault, Cron, true, TaskType, Description, AcceptanceCriteria, null, null), cancellation);

        if (!saved.Ok)
            throw new InvalidOperationException($"The vault review schedule of {vault} was refused: {saved.Problem!.Detail}");
    }

    private Task<bool> HasOneAsync(string vault, CancellationToken cancellation)
    {
        return db.TaskSchedules.AnyAsync(schedule => schedule.Vault == vault && schedule.TaskType == TaskType, cancellation);
    }
}
