using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PowerLoom.Domain.Repos;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Repos;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.Features.Repos;

// Settings → Repositories (user decision 2026-10-06): the ADO repos' switch, and local repos by hand.
public static class CatalogEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/repos/{id}/enabled")]
    public static async Task<Ok> SetEnabled(string vault, string id, EnabledRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        await LocalRepos.SetEnabledAsync(db, vault, RepoId(id), request.Enabled, cancellation);

        return TypedResults.Ok();
    }

    [WolverinePost("/api/vaults/{vault}/repos/local")]
    public static async Task<Results<Ok<RepoSummary>, ProblemHttpResult>> AddLocal(string vault, AddLocalRepoRequest request, PowerLoomDbContext db, IOptions<ReposOptions> options, CancellationToken cancellation)
    {
        var mount = string.IsNullOrWhiteSpace(options.Value.Mount) ? null : options.Value.Mount;
        var added = await LocalRepos.AddAsync(db, vault, request.Name, mount, cancellation);

        return added.Ok ? TypedResults.Ok(new RepoSummary(added.Value!.Id, added.Value.Name, !added.Value.Excluded)) : added.Problem!.ToProblemResult();
    }

    [WolverineDelete("/api/vaults/{vault}/repos/{id}")]
    public static async Task<Ok> RemoveLocal(string vault, string id, [FromServices] PowerLoomDbContext db, CancellationToken cancellation)
    {
        await LocalRepos.RemoveAsync(db, vault, RepoId(id), cancellation);

        return TypedResults.Ok();
    }

    // A GitHub repo's id holds its `owner/name`: its slash arrives still escaped (%2F), which routing keeps as it is.
    private static string RepoId(string id) => Uri.UnescapeDataString(id);
}
