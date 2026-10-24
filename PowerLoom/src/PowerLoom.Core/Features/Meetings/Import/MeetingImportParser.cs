using System.Text.Json;
using PowerLoom.Contracts;
using PowerLoom.Features.Meetings.Models;

namespace PowerLoom.Features.Meetings.Import;

// The meetings file, checked field by field (the tool writes camelCase JSON).
public static class MeetingImportParser
{
    public static Outcome<MeetingImport> Parse(JsonElement content)
    {
        if (content.ValueKind != JsonValueKind.Object)
            return Failure("Not a meeting: a JSON object is required.");

        var source = Text(content, "source");
        var sourceRef = Text(content, "sourceRef");
        var title = Text(content, "title");
        var transcript = Text(content, "transcript");

        if (source is null || sourceRef is null)
            return Failure("source and sourceRef are required.");

        if (title is null || transcript is null)
            return Failure("title and transcript are required.");

        return Times(content) is var (startedAt, endedAt) && startedAt is not null && endedAt is not null
            ? Outcome<MeetingImport>.Success(Build(content, source, sourceRef, title, transcript, startedAt.Value, endedAt.Value))
            : Failure("startedAt and endedAt must be ISO 8601 times.");
    }

    private static MeetingImport Build(JsonElement content, string source, string sourceRef, string title, string transcript, DateTimeOffset startedAt, DateTimeOffset endedAt) =>
        new(
            source,
            sourceRef,
            title,
            startedAt,
            endedAt,
            Number(content, "durationSec") ?? (int)(endedAt - startedAt).TotalSeconds,
            Text(content, "model"),
            Text(content, "transcriptPath"),
            transcript,
            Number(content, "segmentCount") ?? 0,
            Strings(content, "speakers"));

    private static (DateTimeOffset?, DateTimeOffset?) Times(JsonElement content) => (Time(content, "startedAt"), Time(content, "endedAt"));

    private static Outcome<MeetingImport> Failure(string detail) => Outcome<MeetingImport>.Failure(Problem.Invalid(detail));

    private static string? Text(JsonElement value, string name)
    {
        if (!value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
            return null;

        return string.IsNullOrWhiteSpace(property.GetString()) ? null : property.GetString()!.Trim();
    }

    private static DateTimeOffset? Time(JsonElement value, string name) =>
        Text(value, name) is { } text && DateTimeOffset.TryParse(text, null, System.Globalization.DateTimeStyles.AssumeUniversal, out var time) ? time : null;

    private static int? Number(JsonElement value, string name) =>
        value.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number) ? number : null;

    private static IReadOnlyList<string> Strings(JsonElement value, string name)
    {
        if (!value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Array)
            return [];

        return property.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!).ToList();
    }
}
