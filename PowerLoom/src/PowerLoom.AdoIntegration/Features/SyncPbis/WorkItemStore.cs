using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Mirrors work items into `work_item`; their notes follow from DiscussionSync, after the sync.
public sealed class WorkItemStore(PowerLoomDbContext db, AdoSettingsStore settings)
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

        if (existing.Rev == item.Rev && (existing.ExtraFieldsMd is null || existing.AttachedFiles is null))
            return await AddLateFieldsAsync(existing, item, cancellation);

        if (existing.Rev == item.Rev)
            return await LinkArrivedParentAsync(vault, existing, item, cancellation);

        await UpdateAsync(vault, runId, existing, item, cancellation);

        return true;
    }

    private async Task InsertAsync(string vault, long runId, MappedWorkItem item, CancellationToken cancellation)
    {
        var status = PipelineStatusRule.Initial(item.AdoState);
        var parentId = await ParentInPowerLoomAsync(vault, item, cancellation);
        var row = new WorkItem { AdoId = item.AdoId, Vault = vault, ParentId = parentId, Skills = "[]", ConfluencePages = "[]", PipelineStatus = status };

        Mirror(row, item);
        db.WorkItems.Add(row);
        PbiStatusChange.Set(db, row, null, status, Actor, runId);

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, null, parentId, cancellation);
    }

    private async Task UpdateAsync(string vault, long runId, WorkItem existing, MappedWorkItem item, CancellationToken cancellation)
    {
        var parentId = await ParentInPowerLoomAsync(vault, item, cancellation);
        var previousParentId = existing.ParentId;
        var status = PipelineStatusRule.Next(existing.PipelineStatus, item.AdoState, existing.ClosedByUser);
        var closedInAdo = status == PipelineStatus.Closed && existing.PipelineStatus != PipelineStatus.Closed;
        var reassigned = await IsReassignedAsync(existing, item, status, cancellation);

        Mirror(existing, item);
        existing.ParentId = parentId;

        if (status != existing.PipelineStatus)
            PbiStatusChange.Set(db, existing, existing.PipelineStatus, status, Actor, runId);

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, previousParentId, parentId, cancellation);
        await CloseWhenOverAsync(existing, closedInAdo, reassigned, runId, cancellation);
    }

    // The settings are read only when the assignee changed, which few syncs see.
    private async Task<bool> IsReassignedAsync(WorkItem existing, MappedWorkItem item, PipelineStatus status, CancellationToken cancellation)
    {
        if (string.Equals(existing.AssignedTo, item.AssignedTo, StringComparison.OrdinalIgnoreCase))
            return false;

        var ado = await settings.ReadAdoAsync(existing.Vault, cancellation);

        return ado is not null && ReassignmentRule.ClosesPbi(status, existing.AssignedTo, item.AssignedTo, ado.User);
    }

    // Closed in ADO (Done/Removed) or gone to another team member: nothing on the PBI waits on anyone any more (user
    // decision 2026-10-21).
    private async Task CloseWhenOverAsync(WorkItem pbi, bool closedInAdo, bool reassigned, long runId, CancellationToken cancellation)
    {
        if (closedInAdo)
            await PbiOpenItems.CancelAsync(db, pbi.AdoId, Actor, runId, cancellation);

        if (reassigned)
            await PbiClosing.CloseReassignedAsync(db, pbi, Actor, runId, cancellation);
    }

    // An item synced before the team's own text fields and its attached files were read gets them once without an ADO
    // change; clearing the discussion rev has its notes rendered and its documents collected again (DiscussionSync).
    private async Task<bool> AddLateFieldsAsync(WorkItem existing, MappedWorkItem item, CancellationToken cancellation)
    {
        existing.ExtraFieldsMd = item.ExtraFieldsMd;
        existing.AttachedFiles = JsonSerializer.Serialize(item.AttachedFileUrls);
        existing.DiscussionRev = null;

        await db.SaveChangesAsync(cancellation);

        return true;
    }

    // A child whose parent came into PowerLoom after it (e.g. a deleted parent synced by hand again) is linked on the next
    // sync, not only on its next ADO change. True when it was linked.
    private async Task<bool> LinkArrivedParentAsync(string vault, WorkItem existing, MappedWorkItem item, CancellationToken cancellation)
    {
        if (existing.ParentId is not null || item.AdoParentId is null)
            return false;

        var parentId = await ParentInPowerLoomAsync(vault, item, cancellation);

        if (parentId is null)
            return false;

        existing.ParentId = parentId;

        await db.SaveChangesAsync(cancellation);
        await LinkChildAsync(item, null, parentId, cancellation);

        return true;
    }

    // ADO's parent when it is a top-level PBI of this vault in PowerLoom (children stay one level deep); else the item is
    // top-level itself, e.g. a PBI under a Feature.
    private async Task<int?> ParentInPowerLoomAsync(string vault, MappedWorkItem item, CancellationToken cancellation)
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
            await PbiChildren.InheritParentContextAsync(db, item.AdoId, parentId.Value, cancellation);

        if (BugRule.IsMarkedBug(item.Type, item.Title))
            await Bugs.RecordAsync(db, item.AdoId, parentId.Value, BugSource.Ado, Actor, cancellation);
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
        row.ExtraFieldsMd = item.ExtraFieldsMd;
        row.AttachedFiles = JsonSerializer.Serialize(item.AttachedFileUrls);
        row.AdoChangedAt = item.AdoChangedAt;
        row.SyncedAt = DateTime.UtcNow;
    }
}
