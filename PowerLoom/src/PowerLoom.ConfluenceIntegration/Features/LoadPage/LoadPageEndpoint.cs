using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.ConfluenceIntegration.Features.LoadPage.Models;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.ConfluenceIntegration.Features.LoadPage;

// PBI page → Load from Confluence, for a linked page whose content is missing: queued on the vault's queue; it also
// closes the task asking for the content, and a failure becomes (or stays) that task with the reason.
public static class LoadPageEndpoint
{
    [WolverinePost("/api/pbis/{adoId}/confluence-pages/load")]
    public static async Task<Results<Accepted, ProblemHttpResult>> Post(int adoId, LoadPageRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var problem = ConfluencePageLinks.Problem(request.Url);

        if (problem is not null)
            return Problem.Invalid(problem).ToProblemResult();

        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleOrDefaultAsync(cancellation);

        if (vault is null)
            return Problem.NotFound($"PBI-{adoId} isn't in adoa.").ToProblemResult();

        await bus.PublishAsync(new LoadConfluencePage(vault, adoId, request.Url));

        return TypedResults.Accepted((string?)null);
    }
}
