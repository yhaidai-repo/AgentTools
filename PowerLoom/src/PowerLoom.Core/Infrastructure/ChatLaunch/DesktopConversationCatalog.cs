using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Infrastructure.ChatLaunch;

// Only metadata is returned. The runner's agent sessions and archived/subagent conversations are not choices.
public sealed class DesktopConversationCatalog(IOptions<ChatOptions> options)
{
    private const int MetadataLimit = 2 * 1024 * 1024;
    private static readonly EnumerationOptions Scan = new() { RecurseSubdirectories = true, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint };

    public async Task<Outcome<IReadOnlyList<DesktopConversation>>> ReadAsync(string launcher, CancellationToken cancellation)
    {
        var root = launcher switch
        {
            CodexDesktopLauncher.LauncherId => options.Value.CodexHistoryRoot,
            ClaudeDesktopLauncher.LauncherId => options.Value.ClaudeSessionsRoot,
            _ => "",
        };

        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
            return Outcome<IReadOnlyList<DesktopConversation>>.Failure(Problem.Invalid("Desktop chat history isn't available. Run scripts/Set-DesktopChatHistory.ps1 and recreate PowerLoom's backend to connect the read-only history folders."));

        try
        {
            var chats = launcher == CodexDesktopLauncher.LauncherId
                ? await CodexAsync(root, cancellation)
                : await ClaudeAsync(root, cancellation);

            return Outcome<IReadOnlyList<DesktopConversation>>.Success(chats.DistinctBy(chat => chat.Id).OrderByDescending(chat => chat.UpdatedAt).ToList());
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return Outcome<IReadOnlyList<DesktopConversation>>.Failure(Problem.Invalid("Desktop chat history couldn't be read. Check its read-only folder mounts and retry."));
        }
    }

    private static async Task<List<DesktopConversation>> ClaudeAsync(string root, CancellationToken cancellation)
    {
        var chats = new List<DesktopConversation>();

        foreach (var file in Files(root, "local_*.json"))
        {
            using var document = await MetadataAsync(file.FullName, firstLine: false, cancellation);

            if (document is null)
                continue;

            var data = document.RootElement;
            var id = Text(data, "sessionId");

            var delegated = HasValue(data, "spawnedFrom") && (!data.TryGetProperty("spawnedFrom", out var parent) || !Flag(parent, "userFork"));

            if (id is null || !id.StartsWith("local_", StringComparison.Ordinal) || !Guid.TryParseExact(id[6..], "D", out _) || Flag(data, "isArchived") || delegated)
                continue;

            chats.Add(new DesktopConversation(id, Text(data, "title") ?? "Untitled chat", Text(data, "originCwd") ?? Text(data, "cwd") ?? "", Milliseconds(data, "lastActivityAt") ?? file.LastWriteTimeUtc));
        }

        return chats;
    }

    private static async Task<List<DesktopConversation>> CodexAsync(string root, CancellationToken cancellation)
    {
        var sessions = Path.Combine(root, "sessions");

        if (!Directory.Exists(sessions))
            throw new DirectoryNotFoundException();

        var names = await CodexNamesAsync(Path.Combine(root, "session_index.jsonl"), cancellation);
        var chats = new List<DesktopConversation>();

        foreach (var file in Files(sessions, "rollout-*.jsonl"))
        {
            using var document = await MetadataAsync(file.FullName, firstLine: true, cancellation);

            if (document is null || Text(document.RootElement, "type") != "session_meta" || !document.RootElement.TryGetProperty("payload", out var data) || data.ValueKind != JsonValueKind.Object)
                continue;

            var id = Text(data, "id");

            // Explicit user forks can have a parent. Delegated agents use an object-valued source instead.
            if (!Guid.TryParseExact(id, "D", out _) || data.TryGetProperty("source", out var source) && source.ValueKind != JsonValueKind.String)
                continue;

            chats.Add(new DesktopConversation(id!, names.GetValueOrDefault(id!) ?? "Untitled chat", Text(data, "cwd") ?? "", file.LastWriteTimeUtc));
        }

        return chats;
    }

    private static async Task<Dictionary<string, string>> CodexNamesAsync(string path, CancellationToken cancellation)
    {
        var names = new Dictionary<string, string>(StringComparer.Ordinal);

        if (!File.Exists(path))
            return names;

        using var stream = Open(path);
        using var reader = new StreamReader(stream);

        // The index is append-only; later entries rename the same conversation.
        while (await LineAsync(reader, cancellation) is { } line)
        {
            try
            {
                using var document = JsonDocument.Parse(line);
                var data = document.RootElement;

                if (Text(data, "id") is { } id && Text(data, "thread_name") is { } title)
                    names[id] = title;
            }
            catch (JsonException) { /* Ignore a partial append; the next request retries it. */ }
        }

        return names;
    }

    private static IEnumerable<FileInfo> Files(string root, string pattern) => Directory.EnumerateFiles(root, pattern, Scan)
        .Select(path => new FileInfo(path)).OrderByDescending(file => file.LastWriteTimeUtc).Take(2_000);

    private static FileStream Open(string path) => new(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 4096, FileOptions.Asynchronous | FileOptions.SequentialScan);

    private static async Task<JsonDocument?> MetadataAsync(string path, bool firstLine, CancellationToken cancellation)
    {
        try
        {
            using var stream = Open(path);
            using var reader = new StreamReader(stream);
            var text = firstLine ? await LineAsync(reader, cancellation) : stream.Length <= MetadataLimit ? await reader.ReadToEndAsync(cancellation) : null;

            return text is null ? null : JsonDocument.Parse(text);
        }
        catch (Exception error) when (error is JsonException or IOException or UnauthorizedAccessException)
        {
            return null; // A deleted, partially written or unreadable entry must not hide the rest.
        }
    }

    private static async Task<string?> LineAsync(StreamReader reader, CancellationToken cancellation)
    {
        // StreamReader.ReadLineAsync has no length bound. Stop before an unexpectedly large header is allocated.
        var text = new StringBuilder();
        var character = new char[1];

        while (text.Length <= MetadataLimit && await reader.ReadAsync(character.AsMemory(), cancellation) != 0)
        {
            if (character[0] == '\n')
                return text.ToString();

            text.Append(character[0]);
        }

        return text.Length is > 0 and <= MetadataLimit ? text.ToString() : null;
    }

    private static string? Text(JsonElement data, string name) => data.ValueKind == JsonValueKind.Object && data.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static bool Flag(JsonElement data, string name) => data.ValueKind == JsonValueKind.Object && data.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
    private static bool HasValue(JsonElement data, string name) => data.ValueKind == JsonValueKind.Object && data.TryGetProperty(name, out var value) && value.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined);
    private static DateTimeOffset? Milliseconds(JsonElement data, string name) => data.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var milliseconds) && milliseconds is >= 0 and <= 253402300799999 ? DateTimeOffset.FromUnixTimeMilliseconds(milliseconds) : null;
}
