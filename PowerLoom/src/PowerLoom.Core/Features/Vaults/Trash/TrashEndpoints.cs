using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.Vaults.Trash.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Features.Vaults.Trash;

// The Vault page's Maintenance → Trash: inline, the page waits for the result.
public static class TrashEndpoints
{
    // Runs before every endpoint here: the vault must be one adoa still works with.
    public static async Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var exists = await db.VaultExistsAsync(vault, cancellation);

        return exists ? WolverineContinue.NoProblems : Problem.NotFound($"{vault} isn't a vault.").ToProblemDetails();
    }

    [WolverineGet("/api/vaults/{vault}/trash")]
    public static IReadOnlyList<TrashEntry> List(string vault, TrashFolder trash) => trash.List(vault);

    [WolverinePost("/api/vaults/{vault}/trash/restore")]
    public static Results<Ok<string>, ProblemHttpResult> Restore(string vault, TrashPathRequest request, TrashFolder trash) => trash.Restore(vault, request.Path).ToResult();

    [WolverineDelete("/api/vaults/{vault}/trash")]
    public static Results<Ok<string>, ProblemHttpResult> Delete(string vault, TrashPathRequest request, TrashFolder trash) => trash.Delete(vault, request.Path).ToResult();
}
