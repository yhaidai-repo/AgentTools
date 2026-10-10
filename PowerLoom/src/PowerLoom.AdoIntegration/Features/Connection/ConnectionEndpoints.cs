using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.Connection.Models;
using PowerLoom.AdoIntegration.Features.SyncRepositories;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.AdoIntegration.Features.Connection;

// Settings → Azure DevOps: the integration's switch and fields, and the connection test.
public static class ConnectionEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/ado/connection")]
    public static async Task<Results<Ok<SavedConnection>, ProblemHttpResult>> Save(string vault, SaveConnectionRequest request, AdoSettingsStore store, IMessageBus bus, CancellationToken cancellation)
    {
        var pat = await PatOfAsync(vault, request.Pat, store, cancellation);

        if (pat.Length == 0)
            return Problem.Invalid("A personal access token is required.").ToProblemResult();

        var settings = new AdoSettings { Enabled = request.Enabled, OrgUrl = request.OrgUrl.Trim(), Project = request.Project.Trim(), Team = request.Team.Trim(), User = request.User.Trim(), Pat = pat };

        await store.SaveAdoAsync(vault, settings, cancellation);

        // The repo catalog follows a working connection right away (the Settings page lists it).
        if (settings.IsActive)
            await bus.PublishAsync(new SyncRepositories.SyncRepositories(vault));

        return TypedResults.Ok(new SavedConnection(settings.Enabled));
    }

    [WolverinePost("/api/vaults/{vault}/ado/connection/test")]
    public static async Task<Results<Ok<ConnectionCheck>, ProblemHttpResult>> Test(string vault, TestConnectionRequest request, AdoSettingsStore store, ConnectionChecker checker, CancellationToken cancellation)
    {
        var pat = await PatOfAsync(vault, request.Pat, store, cancellation);

        if (pat.Length == 0)
            return Problem.Invalid("Enter the personal access token first.").ToProblemResult();

        return TypedResults.Ok(await checker.CheckAsync(new AdoConnection(request.OrgUrl.Trim(), request.Project.Trim(), request.Team.Trim(), pat), cancellation));
    }

    // The form's token, or the saved one when the field is empty.
    private static async Task<string> PatOfAsync(string vault, string? given, AdoSettingsStore store, CancellationToken cancellation)
    {
        if (!string.IsNullOrWhiteSpace(given))
            return given.Trim();

        return (await store.ReadAdoAsync(vault, cancellation))?.Pat ?? "";
    }
}
