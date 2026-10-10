using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Domain.Repos;

// Repository configuration per vault (user decision 2026-10-06): agents and the PBI repo choice see the enabled ones.
public static class RepoCatalog
{
    public static Task<List<Repo>> EnabledAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        return db.Repos.AsNoTracking().Where(repo => repo.Vault == vault && !repo.Excluded).OrderBy(repo => repo.Name).ToListAsync(cancellation);
    }

    // Matched by name, case-insensitively, against the vault's enabled repos.
    public static async Task<List<Repo>> FindAsync(PowerLoomDbContext db, string vault, IEnumerable<string> names, CancellationToken cancellation)
    {
        var wanted = names.Select(name => name.ToLowerInvariant()).ToHashSet();

        return (await EnabledAsync(db, vault, cancellation)).Where(repo => wanted.Contains(repo.Name.ToLowerInvariant())).ToList();
    }
}
