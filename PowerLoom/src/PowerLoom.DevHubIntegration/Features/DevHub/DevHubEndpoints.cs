using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.DevHubIntegration.Features.DevHub;

// Settings → DevHub (user decision 2026-10-13): the vault's switch, DevHub's URL and token, and the test.
// Which agents may start stacks is each agent's own switch (the `devHub` integration in its Config).
public static class DevHubEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/devhub")]
    public static async Task<Results<Ok<DevHubSummary>, ProblemHttpResult>> Save(string vault, SaveDevHubRequest request, DevHubConnection connection, CancellationToken cancellation)
    {
        var saved = await connection.SaveAsync(vault, request, cancellation);

        return saved.Ok ? TypedResults.Ok(DevHubConnection.SummaryOf(saved.Value)) : saved.Problem.ToProblemResult();
    }

    [WolverinePost("/api/vaults/{vault}/devhub/test")]
    public static async Task<Results<Ok<DevHubCheck>, ProblemHttpResult>> Test(string vault, TestDevHubRequest request, DevHubConnection connection, IDevHubTester tester, CancellationToken cancellation)
    {
        var target = await connection.TestTargetAsync(vault, request, cancellation);

        if (!target.Ok)
            return target.Problem.ToProblemResult();

        return TypedResults.Ok(await tester.TestAsync(target.Value, cancellation));
    }
}
