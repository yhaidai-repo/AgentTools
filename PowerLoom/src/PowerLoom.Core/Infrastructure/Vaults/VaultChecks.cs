using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Infrastructure.Vaults;

// For an endpoint class's ValidateAsync: the `{vault}` of the route must be one adoa still works with.
public static class VaultChecks
{
    public static async Task<ProblemDetails> NotAVaultAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var exists = await db.VaultExistsAsync(vault, cancellation);

        return exists ? WolverineContinue.NoProblems : Problem.NotFound($"{vault} isn't a vault.").ToProblemDetails();
    }
}
