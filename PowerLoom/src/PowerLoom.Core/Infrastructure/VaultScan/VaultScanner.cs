using PowerLoom.Infrastructure.VaultScan.Models;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Infrastructure.VaultScan;

// Reads one vault from disk: every note with its text and mtime, the other files links may point to, and the usage
// log.
public sealed class VaultScanner(VaultRoots roots)
{
    public async Task<VaultIndex> ScanAsync(string vault, CancellationToken cancellation)
    {
        var root = roots.RootOf(vault);
        var files = VisibleFiles(root);
        var notes = new List<ScannedNote>();

        foreach (var path in files.Where(path => path.EndsWith(".md", StringComparison.OrdinalIgnoreCase)))
            notes.Add(await ReadNoteAsync(root, path, cancellation));

        return new VaultIndex(vault, notes, files.Where(path => !path.EndsWith(".md", StringComparison.OrdinalIgnoreCase)).ToList(), await UsageLog.ReadAsync(root, cancellation));
    }

    private static List<string> VisibleFiles(string root)
    {
        if (!Directory.Exists(root))
            return [];

        return Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Select(file => Path.GetRelativePath(root, file).Replace('\\', '/'))
            .Where(path => !ProtectedNotes.IsHiddenPath(path))
            .Order(StringComparer.Ordinal)
            .ToList();
    }

    private static async Task<ScannedNote> ReadNoteAsync(string root, string path, CancellationToken cancellation)
    {
        var fullPath = Path.Combine(root, path);
        var content = await File.ReadAllTextAsync(fullPath, cancellation);
        var name = Path.GetFileNameWithoutExtension(path);

        return new ScannedNote(path, name, NoteText.Title(content) ?? name, File.GetLastWriteTimeUtc(fullPath), content);
    }
}
