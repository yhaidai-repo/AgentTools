using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Skills.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.Features.Skills;

// The Skills page edits adoa's own skills (user decision 2026-10-01); agents use a saved skill from their next run.
public static class SkillsEndpoints
{
    [WolverinePut("/api/skills/{name}")]
    public static async Task<Results<Ok<SavedSkill>, ProblemHttpResult>> Save(string name, SaveSkillRequest request, SkillEditing editing, CancellationToken cancellation)
    {
        var saved = await editing.SaveAsync(name, request.Content, request.Hash, cancellation);

        return saved.Ok ? TypedResults.Ok(new SavedSkill(name, saved.Value, null)) : saved.Problem!.ToProblemResult();
    }

    // A restore is a save of the old content, so the version it replaces becomes a revision too.
    [WolverinePost("/api/skills/{name}/revisions/{id}/restore")]
    public static async Task<Results<Ok<SavedSkill>, ProblemHttpResult>> Restore(string name, int id, RestoreRequest request, SkillEditing editing, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var revision = await db.SkillRevisions.AsNoTracking().SingleOrDefaultAsync(row => row.Id == id && row.Name == name, cancellation);

        if (revision is null)
            return Problem.NotFound("Unknown version.").ToProblemResult();

        var saved = await editing.SaveAsync(name, revision.Content, request.Hash, cancellation);

        return saved.Ok ? TypedResults.Ok(new SavedSkill(name, saved.Value, revision.CreatedAt)) : saved.Problem!.ToProblemResult();
    }
}
