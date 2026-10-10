using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;
using PowerLoom.Persistence;

namespace PowerLoom.Features.ImportSources.Sources;

// A source whose items are JSON files in one folder of the vault's import inbox (the inbox root when the vault has no
// folder; user decision 2026-10-05): imported files are deleted, unusable ones move to failed/ with a .reason.txt.
// Writers write "<name>.json.tmp" and rename it, so a file is never read half written. Subclasses only say how a file's
// content becomes a request.
public abstract class FolderImportSource(PowerLoomDbContext db, IOptions<ImportOptions> options) : IPbiImportSource
{
    private const string FailedFolder = "failed";
    private const string ItemExtension = ".json";

    public abstract string Id { get; }

    // The source's folder inside the vault's inbox folder ("" = the inbox folder itself).
    protected abstract string SubFolder { get; }

    protected abstract Outcome<PbiImportRequest> ToRequest(JsonElement content, string file);

    public async Task<IReadOnlyList<PendingImport>> ReadPendingAsync(string vault, int limit, CancellationToken cancellation)
    {
        var folder = await FolderAsync(vault, cancellation);
        var files = ItemFiles(folder).Take(Math.Max(limit, 0)).ToList();
        var pending = new List<PendingImport>();

        foreach (var file in files)
            pending.Add(await PendingAsync(folder, file, cancellation));

        return pending;
    }

    public async Task<ImportSourceStatus> StatusAsync(string vault, CancellationToken cancellation)
    {
        var folder = await FolderAsync(vault, cancellation);

        return new ImportSourceStatus(Id, ItemFiles(folder).Count(), ItemFiles(Path.Combine(folder, FailedFolder)).Count());
    }

    private async Task<PendingImport> PendingAsync(string folder, string file, CancellationToken cancellation)
    {
        var path = Path.Combine(folder, file);

        return new PendingImport(
            $"{Id}/{file}",
            await ReadRequestAsync(path, file, cancellation),
            _ => { File.Delete(path); return Task.CompletedTask; },
            (reason, _) => MoveToFailedAsync(folder, file, reason));
    }

    // Windows tools may write a BOM; the JSON reader skips it.
    private async Task<Outcome<PbiImportRequest>> ReadRequestAsync(string path, string file, CancellationToken cancellation)
    {
        try
        {
            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path, cancellation));

            return ToRequest(document.RootElement, file);
        }
        catch (JsonException error)
        {
            return Outcome<PbiImportRequest>.Failure(Problem.Invalid($"Not valid JSON: {error.Message}"));
        }
    }

    private static async Task MoveToFailedAsync(string folder, string file, string reason)
    {
        var failed = Path.Combine(folder, FailedFolder);

        Directory.CreateDirectory(failed);
        File.Move(Path.Combine(folder, file), Path.Combine(failed, file), overwrite: true);
        await File.WriteAllTextAsync(Path.Combine(failed, $"{file}.reason.txt"), $"{reason}\n");
    }

    // Oldest first; a missing folder has no items.
    private static IEnumerable<string> ItemFiles(string folder)
    {
        if (!Directory.Exists(folder))
            return [];

        return new DirectoryInfo(folder).EnumerateFiles($"*{ItemExtension}").Where(file => file.Extension.Equals(ItemExtension, StringComparison.OrdinalIgnoreCase)).OrderBy(file => file.LastWriteTimeUtc).Select(file => file.Name).ToList();
    }

    private async Task<string> FolderAsync(string vault, CancellationToken cancellation)
    {
        var importFolder = await db.Vaults.AsNoTracking().Where(row => row.Name == vault).Select(row => row.ImportFolder).SingleOrDefaultAsync(cancellation);
        var root = string.IsNullOrEmpty(importFolder) ? options.Value.InboxRoot : Path.Combine(options.Value.InboxRoot, importFolder);

        return SubFolder.Length == 0 ? root : Path.Combine(root, SubFolder);
    }
}
