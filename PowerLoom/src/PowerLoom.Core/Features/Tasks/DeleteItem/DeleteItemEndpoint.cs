using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.DeleteItem.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.DeleteItem;

// Soft delete: gone from the pages and the vault, kept so agents don't create it again.
public static class DeleteItemEndpoint
{
    private const string Actor = "human";

    [WolverineDelete("/api/items/{id}")]
    public static async Task<Results<Ok<DeletedItem>, ProblemHttpResult>> Delete(string id, DeleteItemRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var deleted = await ItemDeletion.DeleteAsync(db, request.AdoId, id, cancellation);

        if (!deleted.Ok)
            return deleted.Problem!.ToProblemResult();

        await PbiChanges.PublishAsync(db, bus, request.AdoId, Actor, cancellation);

        return TypedResults.Ok(new DeletedItem(id));
    }
}
