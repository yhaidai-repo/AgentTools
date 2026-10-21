using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Features.Vaults.Trash;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Features.Cleanup.Cleaners;

// The two `.trash/` folders of a vault: the docs vault's (the vault review's removals) and its backlog's (closed PBI
// folders). A trashed file older than the buffer goes for good.
public sealed class TrashCleaner(VaultRoots roots, BacklogFiles backlog) : IArtefactCleaner
{
    public const string StoreName = "trash";

    public string Store => StoreName;

    public Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation)
    {
        var cutoff = context.CutoffOf(context.Settings.TrashDays);

        if (cutoff is null)
            return Task.FromResult(CleanerResult.Off);

        var vaultTrash = Path.Combine(roots.RootOf(context.Vault), TrashFolder.FolderName);
        var backlogTrash = backlog.TrashRootOf(context.Vault);
        var actions = Clean("vault", vaultTrash, cutoff.Value, context.DryRun).Concat(Clean("backlog", backlogTrash, cutoff.Value, context.DryRun)).ToList();

        return Task.FromResult(new CleanerResult(actions));
    }

    private static IEnumerable<CleanupAction> Clean(string label, string root, DateTimeOffset cutoff, bool dryRun)
    {
        var actions = StaleFiles.Under(root, cutoff).Select(file => StaleFiles.Remove(StoreName, $"{label}/.trash/{StaleFiles.RelativeTo(root, file)}", file, dryRun)).ToList();

        if (!dryRun)
            StaleFiles.RemoveEmptyFolders(root);

        return actions;
    }
}
