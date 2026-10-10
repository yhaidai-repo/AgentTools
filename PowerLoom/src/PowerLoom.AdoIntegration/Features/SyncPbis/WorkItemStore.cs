using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Mirrors work items into `work_item` (database only: notes are created later, when the user prepares a PBI).
public sealed class WorkItemStore(PowerLoomDbContext db)
{
    private const string Actor = "sync";

    // Returns the items whose mirror changed.
    public async Task<int> UpsertAsync(string vault, long runId, IEnumerable<MappedWorkItem> items, CancellationToken cancellation)
    {
        var changed = 0;

        foreach (var item in items)
            changed += await UpsertAsync(vault, runId, item, cancellation) ? 1 : 0;

        return changed;
    }

    public async Task<bool> UpsertAsync(string vault, long runId, MappedWorkItem item, CancellationToken cancellation)
    {
        var existing = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == item.AdoId, cancellation);

        if (existing is null)
        {
            await InsertAsync(vault, runId, item, cancellation);

            return true;
        }

        if (existing.Rev == item.Rev)
            return await LinkArrivedParentAsync(vault, existing, item, cancellation);

        await UpdateAsync(vault, runId, existing, item, cancellation);

        return true;
    }

    private async Task InsertAsync(string vault, long runId, MappedWorkItem item, CancellationToken cancellation)
    {
        var status = PipelineStatusRule.Initial(item.AdoState);
        var parentId = await ParentInAdoaAsync(vault, item, cancellation);
        var row = new WorkItem { AdoId = item.AdoId, Vault = vault, ParentId = parentId, Skills = "[]", ConfluencePages = "[]", PipelineStatus = status };

        Mirror(row, item);
        db.WorkItems.Add(row);
        PbiStatusChange.Set(db, row, null, status, Actor, runId);

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, null, parentId, cancellation);
    }

    private async Task UpdateAsync(string vault, long runId, WorkItem existing, MappedWorkItem item, CancellationToken cancellation)
    {
        var parentId = await ParentInAdoaAsync(vault, item, cancellation);
        var previousParentId = existing.ParentId;
        var contentChanged = existing.ContentHash != item.ContentHash;
        var status = PipelineStatusRule.Next(existing.PipelineStatus, item.AdoState, contentChanged);

        Mirror(existing, item);
        existing.ParentId = parentId;

        if (status != existing.PipelineStatus)
            PbiStatusChange.Set(db, existing, existing.PipelineStatus, status, Actor, runId);

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, previousParentId, parentId, cancellation);
    }

    // A child whose parent came into adoa after it (e.g. a deleted parent synced by hand again) is linked on the next
    // sync, not only on its next ADO change. True when it was linked.
    private async Task<bool> LinkArrivedParentAsync(string vault, WorkItem existing, MappedWorkItem item, CancellationToken cancellation)
    {
        if (existing.ParentId is not null || item.AdoParentId is null)
            return false;

        var parentId = await ParentInAdoaAsync(vault, item, cancellation);

        if (parentId is null)
            return false;

        existing.ParentId = parentId;

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, null, parentId, cancellation);

        return true;
    }

    // ADO's parent when it is a top-level PBI of this vault in adoa (children stay one level deep); else the item is
    // top-level itself, e.g. a PBI under a Feature.
    private async Task<int?> ParentInAdoaAsync(string vault, MappedWorkItem item, CancellationToken cancellation)
    {
        if (item.AdoParentId is null)
            return null;

        var parent = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == item.AdoParentId && row.Vault == vault && row.ParentId == null).Select(row => row.AdoId).SingleOrDefaultAsync(cancellation);

        return parent == 0 ? null : parent;
    }

    // A new child starts from its parent's skills and repos (user decision 2026-10-09); a [BUG] Task is recorded as a
    // bug of its parent (once).
    private async Task LinkChildAsync(MappedWorkItem item, int? previousParentId, int? parentId, CancellationToken cancellation)
    {
        if (parentId is null)
            return;

        if (parentId != previousParentId)
            await InheritParentContextAsync(item.AdoId, parentId.Value, cancellation);

        if (BugRule.IsMarkedBug(item.Type, item.Title))
            await RecordBugAsync(item.AdoId, parentId.Value, cancellation);
    }

    private async Task InheritParentContextAsync(int childId, int parentId, CancellationToken cancellation)
    {
        var parent = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == parentId).Select(row => row.Skills).SingleAsync(cancellation);
        var child = await db.WorkItems.SingleAsync(row => row.AdoId == childId, cancellation);
        var repos = await db.PbiRepos.AsNoTracking().Where(row => row.PbiId == parentId).ToListAsync(cancellation);
        var known = (await db.PbiRepos.AsNoTracking().Where(row => row.PbiId == childId).Select(row => row.RepoId).ToListAsync(cancellation)).ToHashSet();

        if (HasNoSkills(child.Skills))
            child.Skills = parent;

        db.PbiRepos.AddRange(repos.Where(repo => !known.Contains(repo.RepoId)).Select(repo => new PbiRepo { PbiId = childId, RepoId = repo.RepoId, Source = repo.Source }));

        await db.SaveChangesAsync(cancellation);
    }

    // Bugs are prepared without the user (user decision 2026-10-09). A bug already recorded keeps its first record.
    private async Task RecordBugAsync(int workItemId, int pbiId, CancellationToken cancellation)
    {
        if (await db.Bugs.AnyAsync(bug => bug.WorkItemId == workItemId, cancellation))
            return;

        var parentStatus = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == pbiId).Select(row => row.PipelineStatus).SingleAsync(cancellation);

        db.Bugs.Add(new Bug { WorkItemId = workItemId, PbiId = pbiId, Source = BugSource.Ado, ReportedBy = Actor, FoundIn = parentStatus });

        await db.SaveChangesAsync(cancellation);
    }

    private static bool HasNoSkills(string skills)
    {
        using var document = JsonDocument.Parse(skills);

        return document.RootElement.ValueKind != JsonValueKind.Array || document.RootElement.GetArrayLength() == 0;
    }

    private static void Mirror(WorkItem row, MappedWorkItem item)
    {
        row.Type = item.Type;
        row.Title = item.Title;
        row.AdoState = item.AdoState;
        row.IterationPath = item.IterationPath;
        row.AreaPath = item.AreaPath;
        row.AssignedTo = item.AssignedTo;
        row.Priority = item.Priority;
        row.BacklogPriority = item.BacklogPriority;
        row.Effort = item.Effort;
        row.RemainingWork = item.RemainingWork;
        row.Tags = item.Tags.Count > 0 ? string.Join("; ", item.Tags) : null;
        row.Rev = item.Rev;
        row.ContentHash = item.ContentHash;
        row.DescriptionMd = item.DescriptionMd;
        row.AcceptanceCriteriaMd = item.AcceptanceCriteriaMd;
        row.AdoChangedAt = item.AdoChangedAt;
        row.SyncedAt = DateTime.UtcNow;
    }
}
