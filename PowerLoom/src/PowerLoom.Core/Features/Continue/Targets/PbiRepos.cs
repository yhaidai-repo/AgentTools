using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// The repos a PBI is worked on in: the ones a vault project documents or the user confirmed (user decision
// 2026-10-02); an unconfirmed guess is left out. PBIs refined before repos were recorded keep the latest refinement's list.
public sealed class PbiRepos(PowerLoomDbContext db)
{
    private static readonly RepoSource[] WorkedOn = [RepoSource.VaultDocumented, RepoSource.UserConfirmed];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record RefinementRepo(string Name);

    public async Task<IReadOnlyList<string>> NamesAsync(int adoId, CancellationToken cancellation)
    {
        var recorded = await db.PbiRepos.Where(row => row.PbiId == adoId).Select(row => new { row.Source, row.Repo.Name }).ToListAsync(cancellation);

        if (recorded.Count > 0)
            return recorded.Where(row => WorkedOn.Contains(row.Source)).Select(row => row.Name).ToList();

        var latest = await db.Refinements.Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).Select(row => row.Repos).FirstOrDefaultAsync(cancellation);

        return latest is null ? [] : (JsonSerializer.Deserialize<List<RefinementRepo>>(latest, Json) ?? []).Select(repo => repo.Name).ToList();
    }
}
