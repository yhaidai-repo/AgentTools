using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Repos.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Repos;

// The user's repo list (user decision 2026-10-02): what research and design clone; answers refinement's open repo
// question too.
public static class SaveReposEndpoint
{
    private const string Actor = "human";

    [WolverinePut("/api/pbis/{adoId}/repos")]
    public static async Task<Results<Ok<SavedRepos>, ProblemHttpResult>> Put(int adoId, SaveReposRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var names = request.Repos.Select(name => name.Trim()).Where(name => name.Length > 0).Distinct().ToList();
        var saved = await PbiRepos.SaveAsync(db, adoId, names, cancellation);

        if (!saved.Ok)
            return saved.Problem!.ToProblemResult();

        await PbiChanges.PublishAsync(db, bus, adoId, Actor, cancellation);

        return TypedResults.Ok(new SavedRepos(saved.Value));
    }
}
