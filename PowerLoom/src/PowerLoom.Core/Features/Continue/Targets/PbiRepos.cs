using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Repos;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// The repos a PBI is worked on in: the ones a vault project documents or the user confirmed (user decision
// 2026-10-02); an unconfirmed guess is left out. PBIs refined before repos were recorded keep the latest refinement's list.
// Repos disabled in Settings are left out (user decision 2026-10-13).
public sealed class PbiRepos(PowerLoomDbContext db)
{
    private static readonly RepoSource[] WorkedOn = [RepoSource.VaultDocumented, RepoSource.UserConfirmed];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record RefinementRepo(string Name);

    public async Task<IReadOnlyList<string>> NamesAsync(int adoId, CancellationToken cancellation)
    {
        var recorded = await db.PbiRepos.Where(row => row.PbiId == adoId).Select(row => new { row.Source, row.Repo.Name, row.Repo.Excluded }).ToListAsync(cancellation);

        if (recorded.Count > 0)
            return recorded.Where(row => !row.Excluded && WorkedOn.Contains(row.Source)).Select(row => row.Name).ToList();

        return await RefinementReposAsync(adoId, cancellation);
    }

    // Names as an agent wrote them (a design's plan steps): the enabled catalog repos they name, in their order, each once.
    public async Task<IReadOnlyList<string>> EnabledAsync(string vault, IEnumerable<string> names, CancellationToken cancellation)
    {
        var wanted = names.Select(name => name.Trim()).ToList();
        var enabled = await RepoCatalog.FindAsync(db, vault, wanted, cancellation);

        return wanted.Select(name => enabled.FirstOrDefault(repo => repo.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Name).OfType<string>().Distinct().ToList();
    }

    private async Task<IReadOnlyList<string>> RefinementReposAsync(int adoId, CancellationToken cancellation)
    {
        var vault = await db.WorkItems.Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleOrDefaultAsync(cancellation);
        var latest = await db.Refinements.Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).Select(row => row.Repos).FirstOrDefaultAsync(cancellation);

        if (vault is null || latest is null)
            return [];

        var names = (JsonSerializer.Deserialize<List<RefinementRepo>>(latest, Json) ?? []).Select(repo => repo.Name);

        return await EnabledAsync(vault, names, cancellation);
    }
}
