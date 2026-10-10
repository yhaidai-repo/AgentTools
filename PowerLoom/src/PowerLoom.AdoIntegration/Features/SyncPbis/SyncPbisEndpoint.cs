using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Backlog → Sync now (the sprint), Import now (the import sources) and Sync PBI (one id): queued, the list updates
// in a few seconds.
public static class SyncPbisEndpoint
{
    [WolverinePost("/api/ado/pbis/sync")]
    public static async Task<Results<Accepted, ProblemHttpResult>> Post(SyncPbisRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        await bus.PublishAsync(new SyncPbis(request.Vault, request.AdoId, request.Sources ?? SyncSources.Sprint));

        return TypedResults.Accepted((string?)null);
    }
}
