using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// A task handed to an agent and back: the claim is atomic (only an open task is claimed, so two dispatches can't hand
// out the same task); a release puts it back to open with the reason on the task (the PBI page shows it).
public static class TaskClaims
{
    private static readonly KebabCaseNameTranslator Labels = new();

    public static async Task<bool> ClaimAsync(PowerLoomDbContext db, string taskId, string actor, CancellationToken cancellation)
    {
        var now = DateTime.UtcNow;
        var claimed = await db.LocalItems.Where(item => item.Id == taskId && item.Status == ItemStatus.Open)
            .ExecuteUpdateAsync(set => set.SetProperty(item => item.Status, ItemStatus.InProgress).SetProperty(item => item.HeldBy, "[]").SetProperty(item => item.UpdatedAt, now), cancellation);

        if (claimed == 0)
            return false;

        db.StatusHistories.Add(new StatusHistory { EntityKind = EntityKind.Item, EntityId = taskId, FromStatus = Labels.TranslateMemberName(nameof(ItemStatus.Open)), ToStatus = Labels.TranslateMemberName(nameof(ItemStatus.InProgress)), Actor = actor });
        await db.SaveChangesAsync(cancellation);

        return true;
    }

    // Back to the dispatcher without counting an attempt; only a task still in progress.
    public static async Task<bool> ReleaseAsync(PowerLoomDbContext db, string taskId, string reason, string actor, CancellationToken cancellation)
    {
        var task = await db.LocalItems.SingleOrDefaultAsync(item => item.Id == taskId, cancellation);

        if (task is null || task.Status != ItemStatus.InProgress)
            return false;

        task.HeldBy = JsonSerializer.Serialize(new[] { reason });
        await ItemStatusChange.SetAsync(db, task, ItemStatus.Open, actor, null, cancellation);

        return true;
    }

    public static Task HoldAsync(PowerLoomDbContext db, string taskId, IReadOnlyList<string> reasons, CancellationToken cancellation)
    {
        var held = JsonSerializer.Serialize(reasons);

        return db.LocalItems.Where(item => item.Id == taskId).ExecuteUpdateAsync(set => set.SetProperty(item => item.HeldBy, held), cancellation);
    }
}
