using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Infrastructure.Backlog;

// Text files of a vault's rendered backlog (adoa-backlog/<vault>/…); writes are atomic, like VaultFiles.
public sealed class BacklogFiles(IOptions<BacklogOptions> options)
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

    private string FileOf(string vault, string relativePath) => Path.Combine(options.Value.Root, vault, VaultPath.Trusted(relativePath));
}
