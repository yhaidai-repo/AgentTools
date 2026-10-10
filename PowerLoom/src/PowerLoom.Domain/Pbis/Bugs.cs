using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// Bugs are prepared without the user (user decision 2026-10-09): a new one, or one whose content changed, gets its
// refinement task. PBIs stay manual.
public static class Bugs
{
    // Records a child work item as a bug of its parent, with the parent's status at that moment. A bug already recorded
    // keeps its first record.
    public static async Task RecordAsync(PowerLoomDbContext db, int workItemId, int pbiId, BugSource source, string reportedBy, CancellationToken cancellation)
    {
        if (await db.Bugs.AnyAsync(bug => bug.WorkItemId == workItemId, cancellation))
            return;

        var parentStatus = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == pbiId).Select(row => row.PipelineStatus).SingleAsync(cancellation);

        db.Bugs.Add(new Bug { WorkItemId = workItemId, PbiId = pbiId, Source = source, ReportedBy = reportedBy, FoundIn = parentStatus });

        await db.SaveChangesAsync(cancellation);
    }
}
