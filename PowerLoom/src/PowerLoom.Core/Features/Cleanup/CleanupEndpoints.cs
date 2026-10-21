using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Cleanup;

// Settings → Sync → Cleanup: the buffers, the dry-run switch, and Run now for a report before deletion is switched on.
public static class CleanupEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverineGet("/api/vaults/{vault}/cleanup")]
    public static async Task<CleanupStatus> Get(string vault, CleanupSettingsStore store, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        return new CleanupStatus(vault, settings.DryRun, await store.ReadReportAsync(vault, cancellation));
    }

    [WolverinePut("/api/vaults/{vault}/cleanup")]
    public static async Task<Results<Ok<CleanupSettings>, ProblemHttpResult>> Put(string vault, SaveCleanupSettingsRequest request, CleanupSettingsStore store, CancellationToken cancellation)
    {
        var problem = ProblemOf(request);

        if (problem is not null)
            return problem.ToProblemResult();

        var settings = ToSettings(request);

        await store.SaveAsync(vault, settings, cancellation);

        return TypedResults.Ok(settings);
    }

    // The job runs in the background; the Status page shows the report when it is done.
    [WolverinePost("/api/vaults/{vault}/cleanup/run")]
    public static async Task<Accepted> Run(string vault, IMessageBus bus)
    {
        await bus.PublishAsync(new CleanUpArtefacts(vault));

        return TypedResults.Accepted($"/api/vaults/{vault}/cleanup");
    }

    private static Problem? ProblemOf(SaveCleanupSettingsRequest request)
    {
        var days = new[] { request.ClosedPbiDays, request.TrashDays, request.FailedImportDays, request.RunEventDays, request.BrowserArtefactDays, request.FailedRunBrowserArtefactDays };

        if (days.Any(value => value < 0))
            return Problem.Invalid("Retention days are whole numbers; 0 switches a store's cleanup off.");

        return request.FailedRunBrowserArtefactDays < request.BrowserArtefactDays ? Problem.Invalid("A failed run's recordings are kept at least as long as the others.") : null;
    }

    private static CleanupSettings ToSettings(SaveCleanupSettingsRequest request) => new()
    {
        DryRun = request.DryRun,
        ClosedPbiDays = request.ClosedPbiDays,
        TrashDays = request.TrashDays,
        FailedImportDays = request.FailedImportDays,
        RunEventDays = request.RunEventDays,
        BrowserArtefactDays = request.BrowserArtefactDays,
        FailedRunBrowserArtefactDays = request.FailedRunBrowserArtefactDays,
    };
}
