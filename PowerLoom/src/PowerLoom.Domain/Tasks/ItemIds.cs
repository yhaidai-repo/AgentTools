using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Tasks;

// Item ids are `<prefix>-<adoId>-<nnn>`, numbered per PBI and prefix, never reused. Items that may have no PBI
// (tech-writer tasks, findings, vault reviews, goals) are numbered across the app: `WT-001`, `F-001`, `VR-001`.
public static class ItemIds
{
    public static Task<string> NextAsync(PowerLoomDbContext db, string prefix, int adoId, CancellationToken cancellation) => NextScopedAsync(db, $"{prefix}-{adoId}-", cancellation);

    public static Task<string> NextGlobalAsync(PowerLoomDbContext db, string prefix, CancellationToken cancellation) => NextScopedAsync(db, $"{prefix}-", cancellation);

    // The next `<stem><nnn>` across all items, e.g. stem `CR-6322-` for the review tasks of pull request 6322.
    public static async Task<string> NextScopedAsync(PowerLoomDbContext db, string stem, CancellationToken cancellation)
    {
        // Shared by .NET and TypeScript writers; the database reserves the number before an item is saved.
        return await db.Database.SqlQuery<string>($"select reserve_item_id({stem}) as \"Value\"").SingleAsync(cancellation);
    }
}
