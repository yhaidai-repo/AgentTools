namespace PowerLoom.Infrastructure.VaultScan.Models;

// A Markdown note of a vault as the vault review reads it: `Path` relative to the vault root with `/` separators,
// `Name` the file name without `.md` (what `[[name]]` links use), `Mtime` the last change on disk.
public sealed record ScannedNote(string Path, string Name, string Title, DateTime Mtime, string Content);
