using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// The sync's small records: the cursor (the last id handled), the vault's current sprint (agents take it first), the
// daily sprint snapshot, and the PBIs the user deleted (never brought back by a sync).
public sealed class SyncBookkeeping(PowerLoomDbContext db)
{
    private const string CursorKey = "syncCursor";
    private const string CurrentSprintKey = "currentSprint";

    public async Task<int> ReadCursorAsync(string vault, CancellationToken cancellation)
    {
        var raw = await VaultSettings.ReadRawAsync(db, vault, CursorKey, cancellation);

        return raw is not null && int.TryParse(raw, out var cursor) ? cursor : 0;
    }

    public Task SaveCursorAsync(string vault, int cursor, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, CursorKey, cursor, cancellation);

    public Task SaveCurrentSprintAsync(string vault, string iterationPath, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, CurrentSprintKey, iterationPath, cancellation);

    public async Task<HashSet<int>> DeletedPbiIdsAsync(CancellationToken cancellation) => (await db.DeletedPbis.Select(row => row.AdoId).ToListAsync(cancellation)).ToHashSet();

    public async Task ForgetDeletedPbiAsync(int adoId, CancellationToken cancellation)
    {
        await db.DeletedPbis.Where(row => row.AdoId == adoId).ExecuteDeleteAsync(cancellation);
    }

    // One row per PBI per day for the current sprint; a later sync the same day overwrites it. Effort is the sum of the
    // user's Tasks under the item (ChildTaskEffort), so a [BUG] Task's own Effort counts once, under its parent.
    public async Task SnapshotSprintAsync(string iterationPath, IReadOnlyDictionary<int, decimal> childEffort, CancellationToken cancellation)
    {
        var takenOn = DateOnly.FromDateTime(DateTime.UtcNow);
        var items = await db.WorkItems.AsNoTracking().Where(item => item.IterationPath == iterationPath).ToListAsync(cancellation);
        var existing = await db.SprintSnapshots.Where(row => row.IterationPath == iterationPath && row.TakenOn == takenOn).ToDictionaryAsync(row => row.AdoId, cancellation);

        foreach (var item in items)
            Snapshot(existing.GetValueOrDefault(item.AdoId), item, iterationPath, takenOn, childEffort);

        await CarryMovedOutAsync(iterationPath, takenOn, items.Select(item => item.AdoId).ToHashSet(), existing, cancellation);
        await db.SaveChangesAsync(cancellation);
    }

    private void Snapshot(SprintSnapshot? row, WorkItem item, string iterationPath, DateOnly takenOn, IReadOnlyDictionary<int, decimal> childEffort)
    {
        if (row is null)
            db.SprintSnapshots.Add(row = new SprintSnapshot { IterationPath = iterationPath, TakenOn = takenOn, AdoId = item.AdoId, AdoState = "" });

        row.AdoState = item.AdoState;
        row.Effort = childEffort.TryGetValue(item.AdoId, out var effort) ? effort : null;
        row.RemainingWork = item.RemainingWork;
    }

    // A PBI moved out of the sprint (e.g. to the next one while in testing) stays in its statistics with the state it
    // left in (user decision 2026-10-16): each later day copies its last row, so the sprint keeps what it held. A row an
    // earlier sync took today already holds that state.
    private async Task CarryMovedOutAsync(string iterationPath, DateOnly takenOn, HashSet<int> inSprint, Dictionary<int, SprintSnapshot> today, CancellationToken cancellation)
    {
        var previousDay = await db.SprintSnapshots.Where(row => row.IterationPath == iterationPath && row.TakenOn < takenOn).MaxAsync(row => (DateOnly?)row.TakenOn, cancellation);

        if (previousDay is null)
            return;

        var movedOut = await db.SprintSnapshots.AsNoTracking().Where(row => row.IterationPath == iterationPath && row.TakenOn == previousDay && !inSprint.Contains(row.AdoId)).ToListAsync(cancellation);

        foreach (var row in movedOut.Where(row => !today.ContainsKey(row.AdoId)))
            db.SprintSnapshots.Add(new SprintSnapshot { IterationPath = iterationPath, TakenOn = takenOn, AdoId = row.AdoId, AdoState = row.AdoState, Effort = row.Effort, RemainingWork = row.RemainingWork });
    }
}
