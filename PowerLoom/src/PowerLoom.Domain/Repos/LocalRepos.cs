using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Repos;

// Repository configuration per vault (user decision 2026-10-06): the ADO integration fills the catalog with its repos;
// local repos (folders under the repos root) are added by hand.
public static partial class LocalRepos
{
    public static Task SetEnabledAsync(PowerLoomDbContext db, string vault, string id, bool enabled, CancellationToken cancellation)
    {
        return db.Repos.Where(repo => repo.Vault == vault && repo.Id == id).ExecuteUpdateAsync(set => set.SetProperty(repo => repo.Excluded, !enabled), cancellation);
    }

    // A local repo is a git checkout in the repos root, named by its folder (the same name the chats and clones use).
    // The container sees the root at `reposMount`; null when it isn't mounted, then the folder isn't checked. Its default
    // branch is the one the checkout has out, so the agents' clone doesn't assume main.
    public static async Task<Outcome<Repo>> AddAsync(PowerLoomDbContext db, string vault, string name, string? reposMount, CancellationToken cancellation)
    {
        var folder = name.Trim();
        var problem = await ProblemAsync(db, vault, folder, reposMount, cancellation);

        if (problem is not null)
            return Outcome<Repo>.Failure(Problem.Invalid(problem));

        var checkout = reposMount is null ? null : Path.Combine(reposMount, folder);
        var row = new Repo { Id = $"local:{vault}:{folder}", Vault = vault, Kind = RepoKind.Local, AdoProject = "", Name = folder, RemoteUrl = checkout ?? folder, DefaultBranch = checkout is null ? null : GitRefs.CurrentBranch(checkout), SyncedAt = DateTime.UtcNow };

        db.Repos.Add(row);
        await db.SaveChangesAsync(cancellation);

        return Outcome<Repo>.Success(row);
    }

    public static Task RemoveAsync(PowerLoomDbContext db, string vault, string id, CancellationToken cancellation)
    {
        return db.Repos.Where(repo => repo.Vault == vault && repo.Id == id && repo.Kind == RepoKind.Local).ExecuteDeleteAsync(cancellation);
    }

    private static async Task<string?> ProblemAsync(PowerLoomDbContext db, string vault, string folder, string? reposMount, CancellationToken cancellation)
    {
        if (!LocalName().IsMatch(folder))
            return "A local repo is one folder name inside the repos root.";

        var names = await db.Repos.AsNoTracking().Where(repo => repo.Vault == vault).Select(repo => repo.Name).ToListAsync(cancellation);

        if (names.Any(name => name.Equals(folder, StringComparison.OrdinalIgnoreCase)))
            return $"{folder} is in the vault's repositories already.";

        if (reposMount is null)
            return null;

        return Directory.Exists(Path.Combine(reposMount, folder, ".git")) ? null : $"{folder} isn't a git repository in the repos root.";
    }

    [GeneratedRegex(@"^[\w.-]+$")]
    private static partial Regex LocalName();
}
