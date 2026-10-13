using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Finish.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Finish;

// The Finish dialog, once per PBI (user decision 2026-10-05): done in PowerLoom only (ADO is never written), with the
// user's rating of the agents, the hours spent and, optionally, what went wrong: a WWW record in the docs vault's
// log through Docs / Records, linked to the feedback row.
public static class FinishEndpoint
{
    private const int TitleMax = 80;
    private const string DefaultFault = "Agent";

    private static readonly string[] Faults = ["Human", "Agent"];

    [WolverinePost("/api/pbis/{adoId}/finish")]
    public static async Task<Results<Ok<FinishedPbi>, ProblemHttpResult>> Post(int adoId, FinishRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var problem = ProblemOf(request);

        if (problem is not null)
            return problem.ToProblemResult();

        var actor = string.IsNullOrWhiteSpace(request.Actor) ? "human" : request.Actor.Trim();
        var finished = await PbiFinishing.FinishAsync(db, adoId, actor, cancellation);

        if (!finished.Ok)
            return finished.Problem!.ToProblemResult();

        var wwwRecordId = await RecordFeedbackAsync(db, bus, adoId, request, cancellation);

        await PbiChanges.PublishAsync(db, bus, adoId, actor, cancellation);

        // The children were finished with it: their notes show it too.
        foreach (var childId in await PbiChildren.ChildIdsAsync(db, adoId, cancellation))
            await PbiChanges.PublishAsync(db, bus, childId, actor, cancellation);

        return TypedResults.Ok(new FinishedPbi(finished.Value!, wwwRecordId));
    }

    private static Problem? ProblemOf(FinishRequest request)
    {
        if (request.Rating is < 1 or > 10)
            return Problem.Invalid("The rating is 1 to 10.");

        if (request.EffortHours is < 0 or > 10_000)
            return Problem.Invalid("The effort is 0 to 10000 hours.");

        return request.Fault is not null && !Faults.Contains(request.Fault) ? Problem.Invalid("Fault is Human or Agent.") : null;
    }

    // The rating and effort row; when the user said what went wrong, a WWW record (the text becomes Happened, the rest
    // stays open for later analysis).
    private static async Task<int?> RecordFeedbackAsync(PowerLoomDbContext db, IMessageBus bus, int adoId, FinishRequest request, CancellationToken cancellation)
    {
        var text = string.IsNullOrWhiteSpace(request.WhatWentWrong) ? null : request.WhatWentWrong.Trim();
        var wwwRecordId = text is null ? (int?)null : await LogWhatWentWrongAsync(db, bus, adoId, request, text, cancellation);

        db.PbiFeedbacks.Add(new PbiFeedback { PbiId = adoId, Rating = (short)request.Rating, EffortHours = request.EffortHours, WwwRecordId = wwwRecordId });
        await db.SaveChangesAsync(cancellation);

        return wwwRecordId;
    }

    private static async Task<int> LogWhatWentWrongAsync(PowerLoomDbContext db, IMessageBus bus, int adoId, FinishRequest request, string text, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => new { row.Title, row.Vault }).SingleAsync(cancellation);
        var firstLine = text.Split('\n')[0].TrimEnd('\r');
        var record = new WwwRecord
        {
            Vault = pbi.Vault,
            Source = $"PBI-{adoId} finish",
            Title = $"PBI-{adoId}: {firstLine[..Math.Min(firstLine.Length, TitleMax)]}",
            Kind = "complaint",
            Project = await PbiDocsProject.OfAsync(db, adoId, cancellation),
            Planned = $"The agents (refinement, research, design) prepare PBI-{adoId} \"{pbi.Title}\" so it can be implemented",
            Happened = $"{text} (agent rating {request.Rating}/10, user effort {request.EffortHours} h)",
            Fault = request.Fault ?? DefaultFault,
            Assumptions = "Logged from PowerLoom's Finish dialog; root cause and prevention not analysed yet",
        };

        db.WwwRecords.Add(record);
        await db.SaveChangesAsync(cancellation);
        await bus.PublishAsync(new AddRecord(pbi.Vault, RecordKind.Www, record.Id.ToString()));

        return record.Id;
    }
}
