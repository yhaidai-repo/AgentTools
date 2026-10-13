using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Tasks.CloseItem.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.CloseItem;

// Answer / dismiss a question or finding, finish / cancel a human task. The PBI's status follows and its notes are
// rendered (PbiChanged). The web stores the answer's uploads between a dry run and the close. A finished access
// request reopens the agent tasks anchored to it (user decision 2026-10-13).
public static class CloseItemEndpoint
{
    public const string Closable = "closable";

    private const string Actor = "human";

    [WolverinePost("/api/items/{id}/close")]
    public static async Task<Results<Ok<ClosedItem>, ProblemHttpResult>> Post(string id, CloseRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var closeRequest = new CloseItemRequest(id, request.AdoId, request.Decision, string.IsNullOrWhiteSpace(request.Resolution) ? null : request.Resolution.Trim(), request.HasAttachment);
        var found = await ItemClosing.FindClosableAsync(db, closeRequest, cancellation);

        if (!found.Ok)
            return found.Problem!.ToProblemResult();

        if (request.DryRun)
            return TypedResults.Ok(new ClosedItem(id, Closable));

        var status = await ItemClosing.CloseAsync(db, found.Value!, closeRequest, cancellation);

        await AccessAnchors.AfterCloseAsync(db, found.Value!, status, cancellation);
        await PbiChanges.PublishAsync(db, bus, request.AdoId, Actor, cancellation);

        return TypedResults.Ok(new ClosedItem(id, new KebabCaseNameTranslator().TranslateMemberName(status.ToString())));
    }
}
