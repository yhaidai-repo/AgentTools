using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.LocalStackIntegration.Features.Bridge.Models;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.LocalStackIntegration.Features.Bridge;

// Settings → Local stack (user decision 2026-10-13): the vault's switch, the bridge's URL and token, and the test.
// Which agents may start stacks is each agent's own switch (the `localStack` integration in its Config).
public static class LocalStackEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/local-stack")]
    public static async Task<Results<Ok<LocalStackSummary>, ProblemHttpResult>> Save(string vault, SaveLocalStackRequest request, LocalStackConnection connection, CancellationToken cancellation)
    {
        var saved = await connection.SaveAsync(vault, request, cancellation);

        return saved.Ok ? TypedResults.Ok(LocalStackConnection.SummaryOf(saved.Value)) : saved.Problem.ToProblemResult();
    }

    [WolverinePost("/api/vaults/{vault}/local-stack/test")]
    public static async Task<Results<Ok<LocalStackCheck>, ProblemHttpResult>> Test(string vault, TestLocalStackRequest request, LocalStackConnection connection, ILocalStackTester tester, CancellationToken cancellation)
    {
        var target = await connection.TestTargetAsync(vault, request, cancellation);

        if (!target.Ok)
            return target.Problem.ToProblemResult();

        return TypedResults.Ok(await tester.TestAsync(target.Value, cancellation));
    }
}
