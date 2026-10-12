using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Settings → Read Azure (user decision 2026-10-12): the vault's switch, its service principal, its resources and the
// identity test. Which agents may read is each agent's own switch per kind (the `readAzureLogs`, `readCosmos`,
// `readServiceBus`, `readMongo` integrations in its Config).
public static class ReadAzureEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/read-azure")]
    public static async Task<Ok> SetEnabled(string vault, EnabledRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        await resources.SetEnabledAsync(vault, request.Enabled, cancellation);

        return TypedResults.Ok();
    }

    [WolverinePut("/api/vaults/{vault}/read-azure/identity")]
    public static async Task<Results<Ok<AzureIdentitySummary>, ProblemHttpResult>> SaveIdentity(string vault, SaveAzureIdentityRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var saved = await resources.SaveIdentityAsync(vault, request.TenantId, request.ClientId, request.ClientSecret, cancellation);

        return saved.Ok ? TypedResults.Ok(new AzureIdentitySummary(saved.Value.TenantId, saved.Value.ClientId)) : saved.Problem.ToProblemResult();
    }

    [WolverinePost("/api/vaults/{vault}/read-azure/resources")]
    public static async Task<Results<Ok<AzureResourceSummary>, ProblemHttpResult>> Add(string vault, AddAzureResourceRequest request, ReadAzureResources resources, CancellationToken cancellation)
    {
        var added = await resources.AddAsync(vault, request.Name, request.Kind, request.Target, cancellation);

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

    // Signs in with the form's values (an empty secret means the saved one) and asks Entra for a token. Nothing is saved.
    [WolverinePost("/api/vaults/{vault}/read-azure/identity/test")]
    public static async Task<Results<Ok<AzureIdentityCheck>, ProblemHttpResult>> TestIdentity(string vault, TestAzureIdentityRequest request, ReadAzureSettingsStore store, IAzureIdentityTester tester, CancellationToken cancellation)
    {
        var saved = (await store.ReadAsync(vault, cancellation)).Identity;
        var secret = string.IsNullOrWhiteSpace(request.ClientSecret) ? saved?.ClientSecret ?? "" : request.ClientSecret.Trim();

        if (secret.Length == 0)
            return Problem.Invalid("Enter the client secret first.").ToProblemResult();

        var identity = new AzureIdentitySettings { TenantId = request.TenantId.Trim(), ClientId = request.ClientId.Trim(), ClientSecret = secret };

        return TypedResults.Ok(await tester.TestAsync(identity, cancellation));
    }

    private static AzureResourceSummary SummaryOf(AzureResourceSettings resource) => new(resource.Name, resource.Kind, resource.Display, resource.Enabled);
}
