using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Features.Tasks.ReportBug.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.ReportBug;

// An issue the user finds after design (user decision 2026-10-09): a child item of the PBI plus an internal bug
// record, prepared right away so its agents start like on a PBI. A link to a child item files it under that child's
// parent.
public static class ReportBugEndpoint
{
    private const int TitleMax = 240;
    private const int DefaultPriority = 2;

    [WolverinePost("/api/bugs")]
    public static async Task<Results<Ok<ReportedBug>, ProblemHttpResult>> Post(ReportBugRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var problem = ProblemOf(request);

        if (problem is not null)
            return problem.ToProblemResult();

        var parentId = PbiReference.Parse(request.Parent);

        if (parentId is null)
            return Problem.Invalid($"Not a PBI link or id: {request.Parent}").ToProblemResult();

        var parent = await PbiChildren.TopLevelAsync(db, parentId.Value, cancellation);

        if (parent is null)
            return Problem.NotFound($"PBI-{parentId} isn't in adoa.").ToProblemResult();

        var actor = string.IsNullOrWhiteSpace(request.Actor) ? "human" : request.Actor.Trim();
        var bug = new NewPbi(parent.Vault, BugRule.BugTitle(request.Title.Trim()), BugRule.WorkItemType, request.Priority ?? DefaultPriority, Text(request.DescriptionMd), null, parent.AdoId);
        var adoId = await LocalPbis.CreateAsync(db, actor, bug, cancellation);

        await Bugs.RecordAsync(db, adoId, parent.AdoId, BugSource.Internal, actor, cancellation);
        await bus.PublishAsync(new PreparePbi(parent.Vault, adoId, actor));
        await bus.PublishAsync(new PbiChanged(parent.Vault, parent.AdoId));

        return TypedResults.Ok(new ReportedBug(adoId, parent.AdoId));
    }

    private static Problem? ProblemOf(ReportBugRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Parent))
            return Problem.Invalid("The parent PBI is required.");

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > TitleMax)
            return Problem.Invalid($"A title of 1 to {TitleMax} characters is required.");

        return request.Priority is < 1 or > 4 ? Problem.Invalid("Priority is 1 to 4.") : null;
    }

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
