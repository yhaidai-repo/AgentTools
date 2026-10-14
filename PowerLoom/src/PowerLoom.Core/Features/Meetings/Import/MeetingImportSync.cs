using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.ImportSources.Sources;
using PowerLoom.Features.Meetings.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Meetings.Import;

// One run over the vault's meetings inbox (<inbox>/<vault folder>/meetings, like the mail import; user decision
// 2026-10-14): each file becomes a transcript note and a meeting task, then is deleted; an unusable file moves to
// failed/ with the reason. At most the import settings' items per run.
public sealed class MeetingImportSync(PowerLoomDbContext db, IOptions<ImportOptions> options, ImportSettingsStore settings, MeetingTaskCreation tasks)
{
    public const string SubFolder = "meetings";

    public async Task<IReadOnlyList<string>> RunAsync(string vault, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(options.Value.InboxRoot))
            return ["Import:InboxRoot is not set"];

        var folder = await InboxFolders.FolderAsync(db, options.Value.InboxRoot, vault, SubFolder, cancellation);
        var max = (await settings.ReadAsync(vault, cancellation)).MaxItemsPerRun;
        var messages = new List<string>();

        foreach (var file in InboxFolders.ItemFiles(folder).Take(Math.Max(max, 0)).ToList())
            messages.Add($"{SubFolder}/{file}: {await ImportOneAsync(vault, folder, file, cancellation)}");

        return messages;
    }

    private async Task<string> ImportOneAsync(string vault, string folder, string file, CancellationToken cancellation)
    {
        var path = Path.Combine(folder, file);
        var meeting = await ReadAsync(path, cancellation);

        if (!meeting.Ok)
        {
            await InboxFolders.MoveToFailedAsync(folder, file, meeting.Problem!.Detail);

            return $"set aside: {meeting.Problem.Detail}";
        }

        var outcome = await tasks.CreateAsync(vault, meeting.Value!, cancellation);

        File.Delete(path);

        return outcome.Message;
    }

    // Windows tools may write a BOM; the JSON reader skips it.
    private static async Task<Outcome<MeetingImport>> ReadAsync(string path, CancellationToken cancellation)
    {
        try
        {
            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path, cancellation));

            return MeetingImportParser.Parse(document.RootElement);
        }
        catch (JsonException error)
        {
            return Outcome<MeetingImport>.Failure(Problem.Invalid($"Not valid JSON: {error.Message}"));
        }
    }
}
