namespace PowerLoom.Infrastructure.Vaults;

// Text files of a vault. Writes are atomic (a temp file, then a rename): a reader, or the inline write of a chat note
// next to a background render, never sees a half-written file.
public sealed class VaultFiles(VaultRoots roots)
{
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

    public bool Exists(string vault, string relativePath) => File.Exists(FileOf(vault, relativePath));

    private string FileOf(string vault, string relativePath) => Path.Combine(roots.RootOf(vault), VaultPath.Trusted(relativePath));
}
