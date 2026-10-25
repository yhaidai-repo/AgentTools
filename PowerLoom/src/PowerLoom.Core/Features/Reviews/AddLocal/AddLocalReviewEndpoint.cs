using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Features.Reviews.AddLocal.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Repos;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Features.Reviews.AddLocal;

// Reviews → Add local review: no Azure DevOps settings needed.
public static class AddLocalReviewEndpoint
{
    [WolverinePost("/api/reviews/local")]
    public static async Task<Results<Ok<AddedLocalReview>, ProblemHttpResult>> Post(AddLocalReviewRequest request, PowerLoomDbContext db, IOptions<ReposOptions> options, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        var mount = string.IsNullOrWhiteSpace(options.Value.Mount) ? null : options.Value.Mount;

        return (await LocalReviewAdding.AddAsync(db, mount, request, cancellation)).ToResult();
    }
}
