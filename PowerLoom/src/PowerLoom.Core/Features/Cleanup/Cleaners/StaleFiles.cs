using PowerLoom.Features.Cleanup.Models;

namespace PowerLoom.Features.Cleanup.Cleaners;

// Files under a folder whose last write is before the cutoff, and their removal; folders left empty go with them.
public static class StaleFiles
{
    public static IReadOnlyList<FileInfo> Under(string folder, DateTimeOffset cutoff)
    {
        if (!Directory.Exists(folder))
            return [];

        return new DirectoryInfo(folder).EnumerateFiles("*", SearchOption.AllDirectories)
            .Where(file => file.LastWriteTimeUtc < cutoff.UtcDateTime)
            .OrderBy(file => file.FullName, StringComparer.Ordinal)
            .ToList();
    }

    // The size is read first: a deleted FileInfo has no length any more.
    public static CleanupAction Remove(string store, string target, FileInfo file, bool dryRun)
    {
        var bytes = file.Length;

        if (dryRun)
            return CleanupAction.Planned(store, target, bytes);

        try
        {
            file.Delete();

            return CleanupAction.Removed(store, target, bytes);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return CleanupAction.Failed(store, target, bytes, error.Message);
        }
    }

    // Deepest first, so a folder whose only content was emptied folders goes too; the root stays.
    public static void RemoveEmptyFolders(string root)
    {
        if (!Directory.Exists(root))
            return;

        var folders = Directory.EnumerateDirectories(root, "*", SearchOption.AllDirectories).OrderByDescending(path => path.Length).ToList();

        foreach (var folder in folders.Where(folder => !Directory.EnumerateFileSystemEntries(folder).Any()))
            Directory.Delete(folder);
    }

    public static long SizeOf(string folder)
    {
        if (!Directory.Exists(folder))
            return 0;

        return new DirectoryInfo(folder).EnumerateFiles("*", SearchOption.AllDirectories).Sum(file => file.Length);
    }

    public static string RelativeTo(string root, FileInfo file) => Path.GetRelativePath(root, file.FullName).Replace('\\', '/');
}
