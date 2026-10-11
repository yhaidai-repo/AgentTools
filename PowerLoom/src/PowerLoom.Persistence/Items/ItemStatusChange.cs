using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Items;

// An item's status change with its history row, in one save (PowerLoom's setItemStatus).
public static class ItemStatusChange
{
    private static readonly ItemStatus[] Closed = [ItemStatus.Done, ItemStatus.Cancelled, ItemStatus.Answered, ItemStatus.Dismissed, ItemStatus.Deleted];
    private static readonly KebabCaseNameTranslator Labels = new();

    public static Task SetAsync(PowerLoomDbContext db, LocalItem item, ItemStatus to, string actor, long? runId, CancellationToken cancellation)
    {
        var now = DateTime.UtcNow;
        var history = new StatusHistory
        {
            EntityKind = EntityKind.Item,
            EntityId = item.Id,
            FromStatus = Labels.TranslateMemberName(item.Status.ToString()),
            ToStatus = Labels.TranslateMemberName(to.ToString()),
            Actor = actor,
            RunId = runId,
        };

        item.Status = to;
        item.UpdatedAt = now;
        item.ClosedAt = Closed.Contains(to) ? now : null;
        db.StatusHistories.Add(history);

        return db.SaveChangesAsync(cancellation);
    }
}
