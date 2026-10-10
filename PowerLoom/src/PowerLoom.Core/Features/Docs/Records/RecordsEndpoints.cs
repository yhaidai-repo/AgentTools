using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Docs.Records;

public static class RecordsEndpoints
{
    // Queues the write: the page says "on its way", the record's id shows after a reload.
    [WolverinePost("/api/records")]
    public static async Task<Results<Accepted, ProblemHttpResult>> Post(AddRecordRequest request, RecordSources sources, IMessageBus bus, CancellationToken cancellation)
    {
        var vault = await sources.VaultOfAsync(request.Kind, request.SourceId, cancellation);

        if (!vault.Ok)
            return TypedResults.Problem(vault.Problem.Detail, statusCode: vault.Problem.Status);

        await bus.PublishAsync(new AddRecord(vault.Value, request.Kind, request.SourceId));

        return TypedResults.Accepted((string?)null);
    }
}
