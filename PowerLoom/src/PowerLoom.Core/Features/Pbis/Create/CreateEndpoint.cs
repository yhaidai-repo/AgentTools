using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Features.Pbis.Create.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Create;

// A PBI created in adoa (user decision 2026-10-06), for vaults without an ADO integration or for work ADO doesn't
// track; the user prepares it for refinement as usual. A child goes to its parent's vault (one level: a child's child
// goes to the top PBI, user decision 2026-10-09).
public static class CreateEndpoint
{
    private const int TitleMax = 255;
    private const int DefaultPriority = 2;
    private const string DefaultType = "Product Backlog Item";

    private static readonly string[] Types = [DefaultType, "Bug", "Task"];

    [WolverinePost("/api/pbis")]
    public static async Task<Results<Ok<CreatedPbi>, ProblemHttpResult>> Post(CreatePbiRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var problem = ProblemOf(request);

        if (problem is not null)
            return problem.ToProblemResult();

        var target = await TargetAsync(request, db, cancellation);

        if (!target.Ok)
            return target.Problem!.ToProblemResult();

        var actor = string.IsNullOrWhiteSpace(request.Actor) ? "human" : request.Actor.Trim();
        var pbi = new NewPbi(target.Value!.Vault, request.Title.Trim(), request.Type ?? DefaultType, request.Priority ?? DefaultPriority, Text(request.DescriptionMd), Text(request.AcceptanceCriteriaMd), target.Value.ParentId);
        var adoId = await LocalPbis.CreateAsync(db, actor, pbi, cancellation);

        return TypedResults.Ok(new CreatedPbi(adoId, target.Value.Vault));
    }

    private static Problem? ProblemOf(CreatePbiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > TitleMax)
            return Problem.Invalid($"A title of 1 to {TitleMax} characters is required.");

        if (request.Type is not null && !Types.Contains(request.Type))
            return Problem.Invalid($"The type is one of {string.Join(", ", Types)}.");

        return request.Priority is < 1 or > 4 ? Problem.Invalid("Priority is 1 to 4.") : null;
    }

    // Where the new PBI goes: the named vault, or for a child its parent's.
    private static async Task<Outcome<PbiTarget>> TargetAsync(CreatePbiRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (request.ParentId is null)
            return await VaultTargetAsync(request.Vault, db, cancellation);

        var parent = await PbiChildren.TopLevelAsync(db, request.ParentId.Value, cancellation);

        if (parent is null)
            return Outcome<PbiTarget>.Failure(Problem.NotFound($"PBI-{request.ParentId} isn't in adoa."));

        if (!string.IsNullOrWhiteSpace(request.Vault) && request.Vault != parent.Vault)
            return Outcome<PbiTarget>.Failure(Problem.Invalid($"PBI-{parent.AdoId} is in {parent.Vault}, not in {request.Vault}."));

        return Outcome<PbiTarget>.Success(new PbiTarget(parent.Vault, parent.AdoId));
    }

    private static async Task<Outcome<PbiTarget>> VaultTargetAsync(string? vault, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(vault))
            return Outcome<PbiTarget>.Failure(Problem.Invalid("Name a vault, or a parentId for a child item."));

        if (!await db.VaultExistsAsync(vault, cancellation))
            return Outcome<PbiTarget>.Failure(Problem.NotFound($"{vault} isn't a vault."));

        return Outcome<PbiTarget>.Success(new PbiTarget(vault, null));
    }

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record PbiTarget(string Vault, int? ParentId);
}
