using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Closes a PBI in PowerLoom only (ADO untouched, user decision 2026-10-16), e.g. one that went to another team member
// after refinement. Unlike Delete it stays, so agents (better review) can still read it. Its open items are cancelled
// (PbiOpenItems), and its open children close with it. The sync keeps it closed, whatever its ADO state, until the user
// reopens it.
public static class PbiClosing
{
    // A child that is over already keeps its status.
    private static readonly PipelineStatus[] Settled = [PipelineStatus.Done, PipelineStatus.Closed];

    public static async Task<Outcome<string>> CloseAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return NotFound(adoId);

        var children = await OpenChildrenAsync(db, adoId, cancellation);
        var problem = await CloseProblemAsync(db, pbi, children, cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        var cancelled = await CloseWithChildrenAsync(db, pbi, children, actor, null, cancellation);

        return Outcome<string>.Success(CloseSummary(adoId, children.Count, cancelled));
    }

    // The sync closes a PBI that went to another team member as the user would (user decision 2026-10-21), without
    // waiting for a run: the item a run works on is left to it.
    public static async Task CloseReassignedAsync(PowerLoomDbContext db, WorkItem pbi, string actor, long runId, CancellationToken cancellation)
    {
        var children = await OpenChildrenAsync(db, pbi.AdoId, cancellation);

        await CloseWithChildrenAsync(db, pbi, children, actor, runId, cancellation);
    }

    // Only a PBI the user closed comes back; one closed in ADO follows ADO. It starts over as new: prepare it to refine it.
    public static async Task<Outcome<string>> ReopenAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return NotFound(adoId);

        if (!pbi.ClosedByUser)
            return Outcome<string>.Failure(Problem.Conflict($"PBI-{adoId} wasn't closed in PowerLoom."));

        pbi.ClosedByUser = false;
        PbiStatusChange.Set(db, pbi, pbi.PipelineStatus, PipelineStatus.New, actor, null);

        await db.SaveChangesAsync(cancellation);

        return Outcome<string>.Success($"PBI-{adoId} reopened as new.");
    }

    // The PBI must not be closed already, and no run may work on it or on a child about to close with it.
    private static async Task<string?> CloseProblemAsync(PowerLoomDbContext db, WorkItem pbi, List<WorkItem> children, CancellationToken cancellation)
    {
        if (pbi.PipelineStatus == PipelineStatus.Closed)
            return $"PBI-{pbi.AdoId} is closed already.";

        var running = await PbiChildren.RunningRunOnAnyAsync(db, children.Select(child => child.AdoId).Prepend(pbi.AdoId).ToList(), cancellation);

        return running is null ? null : $"RUN-{running.Id} is working on PBI-{running.PbiId}; close it when the run has ended.";
    }

    private static Task<List<WorkItem>> OpenChildrenAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        return db.WorkItems.Where(row => row.ParentId == adoId && !Settled.Contains(row.PipelineStatus)).ToListAsync(cancellation);
    }

    // Returns how many items were cancelled.
    private static async Task<int> CloseWithChildrenAsync(PowerLoomDbContext db, WorkItem pbi, List<WorkItem> children, string actor, long? runId, CancellationToken cancellation)
    {
        var cancelled = 0;

        foreach (var item in children.Prepend(pbi))
            cancelled += await CloseOneAsync(db, item, actor, runId, cancellation);

        await db.SaveChangesAsync(cancellation);

        return cancelled;
    }

    // Closed in PowerLoom, and its open items cancelled; returns how many items were cancelled.
    private static async Task<int> CloseOneAsync(PowerLoomDbContext db, WorkItem item, string actor, long? runId, CancellationToken cancellation)
    {
        var cancelled = await PbiOpenItems.CancelAsync(db, item.AdoId, actor, runId, cancellation);

        item.ClosedByUser = true;
        PbiStatusChange.Set(db, item, item.PipelineStatus, PipelineStatus.Closed, actor, runId);

        return cancelled;
    }

    private static Outcome<string> NotFound(int adoId) => Outcome<string>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

    private static string CloseSummary(int adoId, int children, int cancelled)
    {
        var childPart = children > 0 ? $"; {children} child item(s) closed" : "";
        var itemPart = cancelled > 0 ? $"; {cancelled} open item(s) cancelled" : "";

        return $"PBI-{adoId} closed{childPart}{itemPart}.";
    }
}
