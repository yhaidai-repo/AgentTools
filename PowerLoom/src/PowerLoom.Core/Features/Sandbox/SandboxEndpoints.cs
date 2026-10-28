using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.Sandbox.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.Features.Sandbox;

// Settings → Data access → Sandbox, per vault. Which agents get a sandbox is each agent's own switch (the `sandbox`
// integration in its Config).
public static class SandboxEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverineGet("/api/vaults/{vault}/sandbox")]
    public static Task<SandboxSetting> Read(string vault, SandboxSettingsStore store, CancellationToken cancellation) => store.ReadAsync(vault, cancellation);

    [WolverinePut("/api/vaults/{vault}/sandbox")]
    public static async Task<Results<Ok<SandboxSetting>, ProblemHttpResult>> Save(string vault, SaveSandboxSettingsRequest request, SandboxSettingsStore store, CancellationToken cancellation)
    {
        var saved = await store.SaveAsync(vault, request, cancellation);

        return saved.Ok ? TypedResults.Ok(saved.Value) : saved.Problem.ToProblemResult();
    }
}
