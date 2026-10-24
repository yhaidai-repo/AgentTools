using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.AdoIntegration.Features.AddReview.Models;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.AdoIntegration.Features.AddReview;

// Reviews → Add review.
public static class AddReviewEndpoint
{
    [WolverinePost("/api/reviews")]
    public static async Task<Results<Ok<AddedReview>, ProblemHttpResult>> Post(AddReviewRequest request, ReviewAdding adding, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        return (await adding.AddAsync(request, cancellation)).ToResult();
    }
}
