using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Repos;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// The user's repo list for a PBI, set on its page (user decision 2026-10-02): what research and design clone. Repos the
// vault documents keep that source; every other kept or added repo is confirmed by the user; removed ones are dropped.
// It answers refinement's open repo question too.
public static class PbiRepos
{
    private const string Actor = "human";

    // The number of repos saved.
    public static async Task<Outcome<int>> SaveAsync(PowerLoomDbContext db, int adoId, IReadOnlyList<string> names, CancellationToken cancellation)
    {
        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleOrDefaultAsync(cancellation);

        if (vault is null)
            return Outcome<int>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

        var chosen = await RepoCatalog.FindAsync(db, vault, names, cancellation);
        var unknown = names.Where(name => !chosen.Any(repo => repo.Name.Equals(name, StringComparison.OrdinalIgnoreCase))).ToList();

        if (unknown.Count > 0)
            return Outcome<int>.Failure(Problem.Invalid($"Not in the repo catalog: {string.Join(", ", unknown)}."));

        await ReplaceAsync(db, adoId, chosen, cancellation);
        await AnswerOpenRepoQuestionsAsync(db, adoId, cancellation);

        return Outcome<int>.Success(chosen.Count);
    }

    private static async Task ReplaceAsync(PowerLoomDbContext db, int adoId, List<Repo> chosen, CancellationToken cancellation)
    {
        var keptIds = chosen.Select(repo => repo.Id).ToList();
        var rows = await db.PbiRepos.Where(row => row.PbiId == adoId).ToListAsync(cancellation);

        db.PbiRepos.RemoveRange(rows.Where(row => !keptIds.Contains(row.RepoId)));

        foreach (var row in rows.Where(row => keptIds.Contains(row.RepoId) && row.Source == RepoSource.AgentAssumed))
            row.Source = RepoSource.UserConfirmed;

        db.PbiRepos.AddRange(chosen.Where(repo => rows.All(row => row.RepoId != repo.Id)).Select(repo => new PbiRepo { PbiId = adoId, RepoId = repo.Id, Source = RepoSource.UserConfirmed }));

        await db.SaveChangesAsync(cancellation);
    }

    private static async Task AnswerOpenRepoQuestionsAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var open = await db.LocalItems.FromSql($"select * from local_item where pbi_id = {adoId} and data->>'key' like 'repos:%'").Where(item => item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress).ToListAsync(cancellation);

        foreach (var question in open)
        {
            question.Resolution = "Set on the PBI page.";
            await ItemStatusChange.SetAsync(db, question, ItemStatus.Answered, Actor, null, cancellation);
        }
    }
}
