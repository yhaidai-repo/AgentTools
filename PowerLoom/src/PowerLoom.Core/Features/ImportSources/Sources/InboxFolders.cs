using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Features.ImportSources.Sources;

// The folders of the import inbox a source reads: the vault's folder (or the inbox root), a sub folder per source,
// `failed/` for unusable files with a .reason.txt each. Writers write "<name>.json.tmp" and rename it, so a file is
// never read half written.
public static class InboxFolders
{
    public const string FailedFolder = "failed";
    private const string ItemExtension = ".json";

    public static async Task<string> FolderAsync(PowerLoomDbContext db, string inboxRoot, string vault, string subFolder, CancellationToken cancellation)
    {
        var importFolder = await db.Vaults.AsNoTracking().Where(row => row.Name == vault).Select(row => row.ImportFolder).SingleOrDefaultAsync(cancellation);
        var root = string.IsNullOrEmpty(importFolder) ? inboxRoot : Path.Combine(inboxRoot, importFolder);

        return subFolder.Length == 0 ? root : Path.Combine(root, subFolder);
    }

    // Oldest first; a missing folder has no items.
    public static IEnumerable<string> ItemFiles(string folder)
    {
        if (!Directory.Exists(folder))
            return [];

        return new DirectoryInfo(folder).EnumerateFiles($"*{ItemExtension}").Where(file => file.Extension.Equals(ItemExtension, StringComparison.OrdinalIgnoreCase)).OrderBy(file => file.LastWriteTimeUtc).Select(file => file.Name).ToList();
    }

    public static async Task MoveToFailedAsync(string folder, string file, string reason)
    {
        var failed = Path.Combine(folder, FailedFolder);

        Directory.CreateDirectory(failed);
        File.Move(Path.Combine(folder, file), Path.Combine(failed, file), overwrite: true);
        await File.WriteAllTextAsync(Path.Combine(failed, $"{file}.reason.txt"), $"{reason}\n");
    }
}
