using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// Closes a PBI in PowerLoom only (ADO untouched, user decision 2026-10-16), e.g. one that went to another team member
// after refinement. Unlike Delete it stays, so agents (better review) can still read it. Every open item on it is
// cancelled, so nothing waits on anyone, and its open children close with it. The sync keeps it closed, whatever its ADO
// state, until the user reopens it.
public static class PbiClosing
{
    // A child that is over already keeps its status.
    private static readonly PipelineStatus[] Settled = [PipelineStatus.Done, PipelineStatus.Closed];
    private static readonly ItemStatus[] Open = [ItemStatus.Open, ItemStatus.InProgress];

    public static async Task<Outcome<string>> CloseAsync(PowerLoomDbContext db, int adoId, string actor, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return NotFound(adoId);

        var children = await db.WorkItems.Where(row => row.ParentId == adoId && !Settled.Contains(row.PipelineStatus)).ToListAsync(cancellation);
        var problem = await CloseProblemAsync(db, pbi, children, cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        var cancelled = 0;

        foreach (var item in children.Prepend(pbi))
            cancelled += await CloseOneAsync(db, item, actor, cancellation);

        await db.SaveChangesAsync(cancellation);

        return Outcome<string>.Success(CloseSummary(adoId, children.Count, cancelled));
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

    // Closed by the user, and every open item on it cancelled; returns how many items were cancelled.
    private static async Task<int> CloseOneAsync(PowerLoomDbContext db, WorkItem item, string actor, CancellationToken cancellation)
    {
        var open = await db.LocalItems.Where(local => local.PbiId == item.AdoId && Open.Contains(local.Status)).ToListAsync(cancellation);

        foreach (var local in open)
            await ItemStatusChange.SetAsync(db, local, ItemStatus.Cancelled, actor, null, cancellation);

        item.ClosedByUser = true;
        PbiStatusChange.Set(db, item, item.PipelineStatus, PipelineStatus.Closed, actor, null);

        return open.Count;
    }

    private static Outcome<string> NotFound(int adoId) => Outcome<string>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

    private static string CloseSummary(int adoId, int children, int cancelled)
    {
        var childPart = children > 0 ? $"; {children} child item(s) closed" : "";
        var itemPart = cancelled > 0 ? $"; {cancelled} open item(s) cancelled" : "";

        return $"PBI-{adoId} closed{childPart}{itemPart}.";
    }
}
