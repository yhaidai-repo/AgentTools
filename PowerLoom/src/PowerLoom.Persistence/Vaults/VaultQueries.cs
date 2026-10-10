using Microsoft.EntityFrameworkCore;

namespace PowerLoom.Persistence.Vaults;

public static class VaultQueries
{
    // A vault adoa still works with: present and not removed in Settings.
    public static Task<bool> VaultExistsAsync(this PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        return db.Vaults.AnyAsync(row => row.Name == vault && row.RemovedAt == null, cancellation);
    }
}
