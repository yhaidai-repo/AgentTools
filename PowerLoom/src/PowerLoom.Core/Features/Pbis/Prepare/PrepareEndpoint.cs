using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Pbis.Prepare.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Prepare;

// Backlog / PBI page → Start: each PBI on its vault's queue with a refinement task ("Start refinement") or a design task
// for the planning agent ("Start planning"); the notes appear in a few seconds.
public static class PrepareEndpoint
{
    private const string Actor = "human";

    [WolverinePost("/api/pbis/prepare")]
    public static Task<Results<Accepted<PreparedPbis>, ProblemHttpResult>> Post(PrepareRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        return QueueAsync(request, ItemKinds.Refinement, db, bus, cancellation);
    }

    [WolverinePost("/api/pbis/plan")]
    public static Task<Results<Accepted<PreparedPbis>, ProblemHttpResult>> PostPlan(PrepareRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        return QueueAsync(request, ItemKinds.Design, db, bus, cancellation);
    }

    private static async Task<Results<Accepted<PreparedPbis>, ProblemHttpResult>> QueueAsync(PrepareRequest request, string taskType, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var ids = request.AdoIds.Distinct().ToList();
        var known = await db.WorkItems.AsNoTracking().Where(row => ids.Contains(row.AdoId)).Select(row => new { row.AdoId, row.Vault, row.ClosedByUser }).ToListAsync(cancellation);

        if (known.Count == 0)
            return Problem.NotFound("None of the PBIs is in PowerLoom.").ToProblemResult();

        var preparable = known.Where(pbi => !pbi.ClosedByUser).ToList();

        foreach (var pbi in preparable)
            await bus.PublishAsync(new PreparePbi(pbi.Vault, pbi.AdoId, Actor, taskType));

        var queued = preparable.Select(pbi => pbi.AdoId).ToList();
        var closed = known.Where(pbi => pbi.ClosedByUser).Select(pbi => pbi.AdoId).ToList();
        var unknown = ids.Except(known.Select(pbi => pbi.AdoId)).ToList();

        return TypedResults.Accepted((string?)null, new PreparedPbis(queued, unknown, closed));
    }
}
