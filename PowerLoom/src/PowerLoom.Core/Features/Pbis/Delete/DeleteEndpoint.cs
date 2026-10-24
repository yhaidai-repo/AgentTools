using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Delete.Models;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Delete;

// "Delete from PowerLoom" (user decision 2026-10-06): the data goes now, through the domain; the PBI's folder in the backlog
// vault follows on the vault's queue. ADO is never changed. Refused while an agent runs on the PBI.
public static class DeleteEndpoint
{
    [WolverineDelete("/api/pbis")]
    public static async Task<Ok<DeletedPbis>> Delete(DeleteRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var result = new DeletedPbis([], []);

        foreach (var adoId in request.AdoIds.Distinct())
            await DeleteOneAsync(adoId, db, bus, result, cancellation);

        return TypedResults.Ok(result);
    }

    private static async Task DeleteOneAsync(int adoId, PowerLoomDbContext db, IMessageBus bus, DeletedPbis result, CancellationToken cancellation)
    {
        var location = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => new { row.Vault, row.VaultPath }).SingleOrDefaultAsync(cancellation);
        var deleted = await PbiDeletion.DeleteAsync(db, adoId, cancellation);

        if (!deleted.Ok)
        {
            result.Refused.Add($"PBI-{adoId}: {deleted.Problem!.Detail}");

            return;
        }

        result.Deleted.Add(new DeletedPbi(adoId, deleted.Value));

        await bus.PublishAsync(new PbiDeleted(location!.Vault, adoId, location.VaultPath));
    }
}
