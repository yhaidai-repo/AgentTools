using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace PowerLoom.Domain.Tasks;

// Items belong to a PBI or, like a chat draft's tech-writer task and its findings, to none.
public static class ItemScope
{
    public static Task<LocalItem?> FindAsync(PowerLoomDbContext db, int? adoId, string itemId, CancellationToken cancellation)
    {
        return db.LocalItems.SingleOrDefaultAsync(item => item.Id == itemId && item.PbiId == adoId, cancellation);
    }

    public static string PbiLabel(int? adoId) => adoId is null ? "no PBI" : $"PBI-{adoId}";
}
