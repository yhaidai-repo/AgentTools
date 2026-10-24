using JasperFx.Core;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.DeadLetters.Models;
using Wolverine.Persistence.Durability;
using Wolverine.Persistence.Durability.DeadLetterManagement;
using Wolverine.Http;

namespace PowerLoom.Features.DeadLetters;

// Wolverine's dead letters for the Agents page (the pg-boss job errors until phase 6): list, replay, discard. A replayed
// message is marked replayable and the durability agent puts it back on its queue.
public static class DeadLettersEndpoints
{
    private const int DefaultLimit = 50;

    [WolverineGet("/api/dead-letters")]
    public static async Task<List<DeadLetterInfo>> List(DateTimeOffset? since, int? limit, [FromServices] IMessageStore store, CancellationToken cancellation)
    {
        var query = new DeadLetterEnvelopeQuery { PageSize = limit ?? DefaultLimit, Range = new TimeRange(since, null) };
        var results = await store.DeadLetters.QueryAsync(query, cancellation);

        return results.Envelopes
            .OrderByDescending(envelope => envelope.SentAt)
            .Select(envelope => new DeadLetterInfo(envelope.Id, envelope.MessageType, envelope.ExceptionType, envelope.ExceptionMessage, envelope.SentAt, envelope.Source, envelope.Replayable))
            .ToList();
    }

    [WolverinePost("/api/dead-letters/{id}/replay")]
    public static async Task<Ok<DeadLetterAction>> Replay(Guid id, [FromServices] IMessageStore store, CancellationToken cancellation)
    {
        await store.DeadLetters.ReplayAsync(new DeadLetterEnvelopeQuery { MessageIds = [id] }, cancellation);

        return TypedResults.Ok(new DeadLetterAction(id));
    }

    [WolverineDelete("/api/dead-letters/{id}")]
    public static async Task<Ok<DeadLetterAction>> Discard(Guid id, [FromServices] IMessageStore store, CancellationToken cancellation)
    {
        await store.DeadLetters.DiscardAsync(new DeadLetterEnvelopeQuery { MessageIds = [id] }, cancellation);

        return TypedResults.Ok(new DeadLetterAction(id));
    }
}
