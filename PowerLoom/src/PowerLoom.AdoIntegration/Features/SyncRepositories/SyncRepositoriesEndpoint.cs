using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.AdoIntegration.Features.SyncRepositories.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine;
using Wolverine.Http;
using Problem = PowerLoom.Contracts.Problem;

namespace PowerLoom.AdoIntegration.Features.SyncRepositories;

public static class SyncRepositoriesEndpoint
{
    [WolverinePost("/api/ado/repositories/sync")]
    public static async Task<Results<Accepted, ProblemHttpResult>> Post(SyncRepositoriesRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        await bus.PublishAsync(new SyncRepositories(request.Vault));

        return TypedResults.Accepted((string?)null);
    }
}
