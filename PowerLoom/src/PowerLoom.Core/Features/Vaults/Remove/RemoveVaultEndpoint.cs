using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Vaults.Remove.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using Wolverine.Http;

namespace PowerLoom.Features.Vaults.Remove;

// PowerLoom forgets the vault; its folder and its history stay (user decision 2026-10-05). Refused while the vault has PBIs
// or waiting tasks, and for the last vault, because every page shows one.
public static class RemoveVaultEndpoint
{
    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    [WolverineDelete("/api/vaults/{vault}")]
    public static async Task<Results<Ok<RemovedVault>, ProblemHttpResult>> Delete(string vault, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var problem = await RemovalProblemAsync(db, vault, cancellation);

        if (problem is not null)
            return problem.ToProblemResult();

        await db.Vaults.Where(row => row.Name == vault).ExecuteUpdateAsync(set => set.SetProperty(row => row.RemovedAt, DateTime.UtcNow), cancellation);

        return TypedResults.Ok(new RemovedVault(vault));
    }

    private static async Task<Problem?> RemovalProblemAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        var active = await db.Vaults.Where(row => row.RemovedAt == null).Select(row => row.Name).ToListAsync(cancellation);

        if (!active.Contains(vault))
            return Problem.NotFound($"{vault} isn't a vault.");

        if (active.Count == 1)
            return Problem.Conflict("PowerLoom needs one vault; add another before removing this one.");

        var pbis = await db.WorkItems.CountAsync(item => item.Vault == vault, cancellation);
        var tasks = await db.LocalItems.CountAsync(item => item.Vault == vault && Waiting.Contains(item.Status), cancellation);

        return pbis + tasks > 0 ? Problem.Conflict($"{vault} still has {pbis} PBI(s) and {tasks} waiting task(s).") : null;
    }
}
