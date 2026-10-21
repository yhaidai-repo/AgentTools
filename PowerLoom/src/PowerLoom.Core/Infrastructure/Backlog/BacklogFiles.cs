using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Infrastructure.Backlog;

// Files of a vault's rendered backlog (powerloom-backlog/<vault>/…); writes are atomic, like VaultFiles, and a note is
// rewritten only when its content changes.
public sealed class BacklogFiles(IOptions<BacklogOptions> options)
{
    public const string TrashFolderName = ".trash";

    public async Task<string?> ReadTextAsync(string vault, string relativePath, CancellationToken cancellation)
    {
        var file = FileOf(vault, relativePath);

        if (!File.Exists(file))
            return null;

        return await File.ReadAllTextAsync(file, cancellation);
    }

    public async Task WriteTextAsync(string vault, string relativePath, string text, CancellationToken cancellation)
    {
        var file = FileOf(vault, relativePath);
        var temp = $"{file}.{Guid.NewGuid():N}.tmp";

        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        await File.WriteAllTextAsync(temp, text, cancellation);
        File.Move(temp, file, overwrite: true);
    }

    // Renders the note with its existing `## Notes` section (the only human-owned part); true when the file changed.
    public async Task<bool> WriteNoteAsync(string vault, string relativePath, Func<string, string> render, CancellationToken cancellation)
    {
        var existing = await ReadTextAsync(vault, relativePath, cancellation);
        var content = render(NotesSection.Of(existing));

        if (content == existing)
            return false;

        await WriteTextAsync(vault, relativePath, content, cancellation);

        return true;
    }

    // Uploaded files never change once written, so an existing file is left alone.
    public async Task<bool> WriteOnceAsync(string vault, string relativePath, byte[] bytes, CancellationToken cancellation)
    {
        var file = FileOf(vault, relativePath);

        if (File.Exists(file))
            return false;

        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        await File.WriteAllBytesAsync(file, bytes, cancellation);

        return true;
    }

    // Creates the file with the default content when missing; never overwrites a user-edited file.
    public async Task<string> ReadOrCreateAsync(string vault, string relativePath, string defaultContent, CancellationToken cancellation)
    {
        var existing = await ReadTextAsync(vault, relativePath, cancellation);

        if (existing is not null)
            return existing;

        await WriteTextAsync(vault, relativePath, defaultContent, cancellation);

        return defaultContent;
    }

    // A note whose item the user deleted; a file that is already gone is fine.
    public void Remove(string vault, string relativePath) => File.Delete(FileOf(vault, relativePath));

    // A deleted PBI's folder with all its notes and attachments; the vault's backlog root itself is never removed.
    public void RemoveFolder(string vault, string relativePath)
    {
        if (relativePath.Trim('/', '\\', '.').Length == 0)
            throw new InvalidOperationException("refusing to remove the backlog root");

        var folder = FileOf(vault, relativePath);

        if (Directory.Exists(folder))
            Directory.Delete(folder, recursive: true);
    }

    // Where a backlog file or folder is on disk (the cleanup measures and moves it there).
    public string PathOf(string vault, string relativePath) => FileOf(vault, relativePath);

    // The vault's backlog `.trash/`: where the cleanup moves a closed PBI's folder, restorable until the trash is emptied.
    public string TrashRootOf(string vault) => Path.Combine(options.Value.Root, vault, TrashFolderName);

    // Moves a file or folder into the backlog's `.trash/` under the same relative path; a stale copy there is replaced.
    public void MoveToTrash(string vault, string relativePath)
    {
        var source = FileOf(vault, relativePath);
        var target = Path.Combine(TrashRootOf(vault), VaultPath.Trusted(relativePath));

        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        ReplaceInTrash(source, target);
    }

    private static void ReplaceInTrash(string source, string target)
    {
        if (Directory.Exists(source))
        {
            if (Directory.Exists(target))
                Directory.Delete(target, recursive: true);

            Directory.Move(source, target);

            return;
        }

        File.Move(source, target, overwrite: true);
    }

    private string FileOf(string vault, string relativePath) => Path.Combine(options.Value.Root, vault, VaultPath.Trusted(relativePath));
}
