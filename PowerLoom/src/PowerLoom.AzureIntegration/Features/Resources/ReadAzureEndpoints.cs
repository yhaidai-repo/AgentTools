using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Settings → Read Azure (user decisions 2026-10-12/14): one switch per kind, the user's own sign-in (the Azure MCP
// server reads with it), the default subscription, and the Cosmos / Mongo accounts. Which agents may read is each
// agent's own switch per kind (the `azureAccess`, `readCosmos`, `readMongo` integrations in its Config).
public static class ReadAzureEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/read-azure/{kind}/enabled")]
    public static async Task<Results<Ok, ProblemHttpResult>> SetKindEnabled(string vault, string kind, EnabledRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var changed = await resources.SetKindEnabledAsync(vault, kind, request.Enabled, cancellation);

        return changed.Ok ? TypedResults.Ok() : changed.Problem.ToProblemResult();
    }

    [WolverinePut("/api/vaults/{vault}/read-azure/subscription")]
    public static async Task<Results<Ok, ProblemHttpResult>> SetSubscription(string vault, AzureSubscriptionRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var changed = await resources.SetSubscriptionAsync(vault, request.Subscription ?? "", cancellation);

        return changed.Ok ? TypedResults.Ok() : changed.Problem.ToProblemResult();
    }

    [WolverinePost("/api/vaults/{vault}/read-azure/resources")]
    public static async Task<Results<Ok<AzureResourceSummary>, ProblemHttpResult>> Add(string vault, AddAzureResourceRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var added = await resources.AddAsync(vault, request.Name, request.Kind, request.Target ?? "", cancellation);

        return added.Ok ? TypedResults.Ok(SummaryOf(added.Value)) : added.Problem.ToProblemResult();
    }

    [WolverinePut("/api/vaults/{vault}/read-azure/resources/{name}/enabled")]
    public static async Task<Results<Ok<AzureResourceSummary>, ProblemHttpResult>> SetResourceEnabled(string vault, string name, EnabledRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var changed = await resources.SetResourceEnabledAsync(vault, name, request.Enabled, cancellation);

        return changed.Ok ? TypedResults.Ok(SummaryOf(changed.Value)) : changed.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/vaults/{vault}/read-azure/resources/{name}")]
    public static async Task<Ok> Remove(string vault, string name, [FromServices] ReadAzureResources resources, CancellationToken cancellation)
    {
        await resources.RemoveAsync(vault, name, cancellation);

        return TypedResults.Ok();
    }

    // The user's own sign-in: Entra's code to type at the link; the runner finishes it in the background.
    [WolverinePost("/api/vaults/{vault}/read-azure/user-login/start")]
    public static async Task<Results<Ok<AzureLoginStart>, ProblemHttpResult>> StartUserLogin(string vault, [FromServices] IAzureUserLogin login, CancellationToken cancellation)
    {
        var started = await login.StartAsync(vault, cancellation);

        return started.Ok ? TypedResults.Ok(started.Value) : started.Problem.ToProblemResult();
    }

    [WolverineGet("/api/vaults/{vault}/read-azure/user-login/{flowId}")]
    public static async Task<Results<Ok<AzureLoginStatus>, ProblemHttpResult>> UserLoginStatus(string vault, string flowId, [FromServices] IAzureUserLogin login, CancellationToken cancellation)
    {
        var status = await login.StatusAsync(flowId, cancellation);

        return status.Ok ? TypedResults.Ok(status.Value) : status.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/vaults/{vault}/read-azure/user-login")]
    public static async Task<Results<Ok, ProblemHttpResult>> SignOut(string vault, [FromServices] IAzureUserLogin login, CancellationToken cancellation)
    {
        var signedOut = await login.SignOutAsync(vault, cancellation);

        return signedOut.Ok ? TypedResults.Ok() : signedOut.Problem.ToProblemResult();
    }

    private static AzureResourceSummary SummaryOf(AzureResourceSettings resource) => new(resource.Name, resource.Kind, resource.Display, resource.Enabled);
}
