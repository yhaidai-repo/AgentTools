using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using Wolverine;

namespace PowerLoom.Features.Tasks;

// After an item change on a PBI: its status follows its tasks, and its notes are rendered on the vault's queue.
public static class PbiChanges
{
    public static async Task PublishAsync(PowerLoomDbContext db, IMessageBus bus, int? adoId, string actor, CancellationToken cancellation)
    {
        if (adoId is null)
            return;

        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleOrDefaultAsync(cancellation);

        if (vault is null)
            return;

        await PbiStatusSync.RecalculateAsync(db, adoId.Value, actor, cancellation);
        await bus.PublishAsync(new PbiChanged(vault, adoId.Value));
    }

    // A change that reached its child items too (finish, close): their notes show it as well.
    public static async Task PublishWithChildrenAsync(PowerLoomDbContext db, IMessageBus bus, int adoId, string actor, CancellationToken cancellation)
    {
        await PublishAsync(db, bus, adoId, actor, cancellation);

        foreach (var childId in await PbiChildren.ChildIdsAsync(db, adoId, cancellation))
            await PublishAsync(db, bus, childId, actor, cancellation);
    }
}
