using PowerLoom.Features.Vaults.Trash.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Contracts;

namespace PowerLoom.Features.Vaults.Trash;

// A vault's `.trash/`: where the vault review moves removed notes (Obsidian's trash, restorable). Never emptied by itself.
public sealed class TrashFolder(VaultRoots roots)
{
    public const string FolderName = ".trash";

    // Every trashed file, newest first.
    public IReadOnlyList<TrashEntry> List(string vault)
    {
        var root = TrashRoot(vault);

        if (!Directory.Exists(root))
            return [];

        return Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Select(file => ToEntry(root, file))
            .OrderByDescending(entry => entry.ModifiedAt)
            .ToList();
    }

    // Puts a trashed file back where it was; refused when a note is there again, so nothing is overwritten.
    public Outcome<string> Restore(string vault, string path)
    {
        var parsed = TrashPath.Parse(path);

        if (!parsed.Ok)
            return parsed;

        var source = Path.Combine(TrashRoot(vault), parsed.Value);
        var target = Path.Combine(roots.RootOf(vault), parsed.Value);
        var problem = RestoreProblem(parsed.Value, source, target);

        if (problem is not null)
            return Outcome<string>.Failure(problem);

        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        File.Move(source, target);

        return parsed;
    }

    // Deletes for good; a file that is already gone is no error.
    public Outcome<string> Delete(string vault, string path)
    {
        var parsed = TrashPath.Parse(path);

        if (!parsed.Ok)
            return parsed;

        File.Delete(Path.Combine(TrashRoot(vault), parsed.Value));

        return parsed;
    }

    private string TrashRoot(string vault) => Path.Combine(roots.RootOf(vault), FolderName);

    private static Problem? RestoreProblem(string relative, string source, string target)
    {
        if (!File.Exists(source))
            return Problem.NotFound($"{relative} isn't in the trash.");

        if (File.Exists(target))
            return Problem.Conflict($"{relative} exists in the vault again; delete or move it first.");

        return null;
    }

    private static TrashEntry ToEntry(string root, string file)
    {
        var info = new FileInfo(file);

        return new TrashEntry(Path.GetRelativePath(root, file).Replace('\\', '/'), info.Length, info.LastWriteTimeUtc);
    }
}
