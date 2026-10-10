using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.AdoIntegration.Features.SyncPullRequests.Models;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// Reviews → Check now: queued, the list updates in a few seconds.
public static class SyncPullRequestsEndpoint
{
    [WolverinePost("/api/ado/pull-requests/sync")]
    public static async Task<Results<Accepted, ProblemHttpResult>> Post(SyncPullRequestsRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        await bus.PublishAsync(new SyncPullRequests(request.Vault));

        return TypedResults.Accepted((string?)null);
    }
}
