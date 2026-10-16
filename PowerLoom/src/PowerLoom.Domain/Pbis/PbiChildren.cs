using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// A PBI's child work items (bugs, tasks under it); children stay one level deep (user decision 2026-10-09).
public static class PbiChildren
{
    public static Task<List<int>> ChildIdsAsync(PowerLoomDbContext db, int parentId, CancellationToken cancellation)
    {
        return db.WorkItems.AsNoTracking().Where(row => row.ParentId == parentId).Select(row => row.AdoId).ToListAsync(cancellation);
    }

    // The PBI an item is filed under: the item itself, or its parent when it is a child (a child of a child goes to the
    // top PBI). Null when PowerLoom doesn't have the item.
    public static async Task<ParentPbi?> TopLevelAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var row = await ReadAsync(db, adoId, cancellation);

        if (row is null || row.ParentId is null)
            return row?.Pbi;

        return (await ReadAsync(db, row.ParentId.Value, cancellation))?.Pbi;
    }

    // A new child starts from its parent's context (user decision 2026-10-09): the parent's skills and repos, so its
    // agents work where the parent's design works.
    public static async Task InheritParentContextAsync(PowerLoomDbContext db, int childId, int parentId, CancellationToken cancellation)
    {
        var parentSkills = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == parentId).Select(row => row.Skills).SingleAsync(cancellation);
        var child = await db.WorkItems.SingleAsync(row => row.AdoId == childId, cancellation);
        var repos = await db.PbiRepos.AsNoTracking().Where(row => row.PbiId == parentId).ToListAsync(cancellation);
        var known = (await db.PbiRepos.AsNoTracking().Where(row => row.PbiId == childId).Select(row => row.RepoId).ToListAsync(cancellation)).ToHashSet();

        if (HasNoSkills(child.Skills))
            child.Skills = parentSkills;

        db.PbiRepos.AddRange(repos.Where(repo => !known.Contains(repo.RepoId)).Select(repo => new PbiRepo { PbiId = childId, RepoId = repo.RepoId, Source = repo.Source }));

        await db.SaveChangesAsync(cancellation);
    }

    // The agent run working on the PBI now, if any.
    // The first run still working on any of the PBIs; null when none is.
    public static Task<RunningRun?> RunningRunOnAnyAsync(PowerLoomDbContext db, List<int> adoIds, CancellationToken cancellation)
    {
        return db.AgentRuns.AsNoTracking().Where(run => run.PbiId != null && adoIds.Contains(run.PbiId.Value) && run.Outcome == RunOutcome.Running).Select(run => new RunningRun(run.Id, run.PbiId!.Value)).FirstOrDefaultAsync(cancellation);
    }

    public static async Task<long?> RunningRunOnAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var running = await db.AgentRuns.AsNoTracking().Where(run => run.PbiId == adoId && run.Outcome == RunOutcome.Running).Select(run => run.Id).FirstOrDefaultAsync(cancellation);

        return running == 0 ? null : running;
    }

    private static async Task<PbiRow?> ReadAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var row = await db.WorkItems.AsNoTracking().Where(item => item.AdoId == adoId).Select(item => new { item.AdoId, item.Title, item.Vault, item.PipelineStatus, item.ParentId }).SingleOrDefaultAsync(cancellation);

        return row is null ? null : new PbiRow(new ParentPbi(row.AdoId, row.Title, row.Vault, row.PipelineStatus), row.ParentId);
    }

    private sealed record PbiRow(ParentPbi Pbi, int? ParentId);

    private static bool HasNoSkills(string skills)
    {
        using var document = JsonDocument.Parse(skills);

        return document.RootElement.ValueKind != JsonValueKind.Array || document.RootElement.GetArrayLength() == 0;
    }
}
