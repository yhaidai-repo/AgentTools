using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.ImportSources.SourceSettings.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Features.ImportSources.SourceSettings;

// Settings → PBI import: the cron, the cap, the vault's folder in the inbox and the switch (feature `mailSync`). The
// ScheduleTicker reads the cron from here: saving is enough.
public static class SourceSettingsEndpoint
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/import-sources")]
    public static async Task<Results<Ok<SavedSourceSettings>, ProblemHttpResult>> Put(string vault, SourceSettingsRequest request, ImportSettingsStore store, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var folder = FolderName(request.ImportFolder);
        var problem = ProblemOf(request, folder);

        if (problem is not null)
            return problem.ToProblemResult();

        await store.SaveAsync(vault, new ImportSettings { Cron = request.Cron.Trim(), MaxItemsPerRun = request.MaxItemsPerRun }, cancellation);
        await db.Vaults.Where(row => row.Name == vault).ExecuteUpdateAsync(set => set.SetProperty(row => row.ImportFolder, folder), cancellation);
        await VaultFeatures.SetAsync(db, vault, VaultFeatures.MailSync, request.Enabled, cancellation);

        return TypedResults.Ok(new SavedSourceSettings(request.Enabled, folder));
    }

    private static Problem? ProblemOf(SourceSettingsRequest request, string? folder)
    {
        if (request.MaxItemsPerRun < 1)
            return Problem.Invalid("Max items per run must be a whole number above 0.");

        if (!CronDue.IsValid(request.Cron.Trim()))
            return Problem.Invalid($"\"{request.Cron}\" isn't a cron expression (five fields, e.g. */5 * * * *).");

        return folder is not null && (folder.Contains('/') || folder.StartsWith('.')) ? Problem.Invalid("The import folder is one folder name inside the import inbox.") : null;
    }

    // The mail import folder: a folder inside the import inbox; null = the inbox root.
    private static string? FolderName(string? importFolder)
    {
        var name = (importFolder ?? "").Replace('\\', '/').Trim('/').Trim();

        return name.Length == 0 ? null : name;
    }
}
