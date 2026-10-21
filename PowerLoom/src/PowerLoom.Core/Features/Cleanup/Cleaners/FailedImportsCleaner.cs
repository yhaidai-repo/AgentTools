using Microsoft.Extensions.Options;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.ImportSources.Sources;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Cleanup.Cleaners;

// The import inbox's `failed/` folders of the vault (its root and every source's sub folder): a set-aside file with
// its .reason.txt goes once it is older than the buffer; the `pbi_import` rows keep the history.
public sealed class FailedImportsCleaner(PowerLoomDbContext db, IOptions<ImportOptions> options) : IArtefactCleaner
{
    public const string StoreName = "failed-imports";

    public string Store => StoreName;

    public async Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation)
    {
        var cutoff = context.CutoffOf(context.Settings.FailedImportDays);

        if (cutoff is null)
            return CleanerResult.Off;

        if (string.IsNullOrWhiteSpace(options.Value.InboxRoot))
            return CleanerResult.Skipped("Import:InboxRoot is not set");

        var root = await InboxFolders.FolderAsync(db, options.Value.InboxRoot, context.Vault, "", cancellation);
        var actions = FailedFolders(root).SelectMany(folder => Clean(root, folder, cutoff.Value, context.DryRun)).ToList();

        return new CleanerResult(actions);
    }

    // `failed/` at the root (the inbox source) and in each source's folder (outlook, meetings).
    private static IEnumerable<string> FailedFolders(string root)
    {
        if (!Directory.Exists(root))
            return [];

        var sources = Directory.EnumerateDirectories(root).Where(folder => Path.GetFileName(folder) != InboxFolders.FailedFolder);

        return new[] { root }.Concat(sources).Select(folder => Path.Combine(folder, InboxFolders.FailedFolder)).Where(Directory.Exists);
    }

    private static IEnumerable<CleanupAction> Clean(string root, string folder, DateTimeOffset cutoff, bool dryRun) =>
        StaleFiles.Under(folder, cutoff).Select(file => StaleFiles.Remove(StoreName, StaleFiles.RelativeTo(root, file), file, dryRun)).ToList();
}
