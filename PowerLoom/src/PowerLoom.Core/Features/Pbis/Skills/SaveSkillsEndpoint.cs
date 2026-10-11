using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Features.Pbis.Skills.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Skills;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Skills;

// The user's skill list for the PBI's later agents (at most 5); from now on refinement leaves it.
public static class SaveSkillsEndpoint
{
    private const string Actor = "human";

    [WolverinePut("/api/pbis/{adoId}/skills")]
    public static async Task<Results<Ok<SavedSkills>, ProblemHttpResult>> Put(int adoId, SaveSkillsRequest request, PowerLoomDbContext db, SkillFiles files, IMessageBus bus, CancellationToken cancellation)
    {
        var choices = request.Skills.Select(skill => new SkillChoice(skill.Name.Trim(), skill.Reason?.Trim() ?? "")).Where(skill => skill.Name.Length > 0).ToList();
        var problems = PbiSkills.Problems(choices.Select(skill => skill.Name).ToList(), files.Names());

        if (problems.Count > 0)
            return Problem.Invalid($"Not saved: {string.Join("; ", problems)}.").ToProblemResult();

        if (!await db.WorkItems.AnyAsync(row => row.AdoId == adoId, cancellation))
            return Problem.NotFound($"PBI-{adoId} isn't in adoa.").ToProblemResult();

        await PbiSkills.SaveChoicesAsync(db, adoId, choices, cancellation);
        await PbiChanges.PublishAsync(db, bus, adoId, Actor, cancellation);

        return TypedResults.Ok(new SavedSkills(choices.Count));
    }
}
