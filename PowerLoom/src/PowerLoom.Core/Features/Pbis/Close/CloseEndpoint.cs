using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Close.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Close;

// Backlog / PBI page → Close (user decision 2026-10-16): closed in PowerLoom only, kept for the agents to read; each PBI
// on its own, a refused one is reported. ADO is never changed.
public static class CloseEndpoint
{
    [WolverinePost("/api/pbis/close")]
    public static async Task<Ok<ClosedPbis>> Post(PbiIdsRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var actor = PbiActor.Of(request);
        var result = new ClosedPbis([], []);

        foreach (var adoId in request.AdoIds.Distinct())
            await CloseOneAsync(adoId, actor, db, bus, result, cancellation);

        return TypedResults.Ok(result);
    }

    private static async Task CloseOneAsync(int adoId, string actor, PowerLoomDbContext db, IMessageBus bus, ClosedPbis result, CancellationToken cancellation)
    {
        var closed = await PbiClosing.CloseAsync(db, adoId, actor, cancellation);

        if (!closed.Ok)
        {
            result.Refused.Add($"PBI-{adoId}: {closed.Problem!.Detail}");

            return;
        }

        result.Done.Add(closed.Value!);

        await PbiChanges.PublishWithChildrenAsync(db, bus, adoId, actor, cancellation);
    }
}
