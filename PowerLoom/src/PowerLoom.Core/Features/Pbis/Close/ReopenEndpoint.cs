using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Close.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Close;

// Backlog / PBI page → Reopen (user decision 2026-10-16): a PBI the user closed starts over as new; its children stay as
// they are.
public static class ReopenEndpoint
{
    [WolverinePost("/api/pbis/reopen")]
    public static async Task<Ok<ClosedPbis>> Post(PbiIdsRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var actor = PbiActor.Of(request);
        var result = new ClosedPbis([], []);

        foreach (var adoId in request.AdoIds.Distinct())
            await ReopenOneAsync(adoId, actor, db, bus, result, cancellation);

        return TypedResults.Ok(result);
    }

    private static async Task ReopenOneAsync(int adoId, string actor, PowerLoomDbContext db, IMessageBus bus, ClosedPbis result, CancellationToken cancellation)
    {
        var reopened = await PbiClosing.ReopenAsync(db, adoId, actor, cancellation);

        if (!reopened.Ok)
        {
            result.Refused.Add($"PBI-{adoId}: {reopened.Problem!.Detail}");

            return;
        }

        result.Done.Add(reopened.Value!);

        await PbiChanges.PublishAsync(db, bus, adoId, actor, cancellation);
    }
}
