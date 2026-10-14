using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Pipeline;

public static class MeetingImports
{
    public const string SourceName = "audio-capture";

    public static MeetingImport From(RecordingSession session, TranscriptResult result, string model) =>
        new(
            SourceName,
            Path.GetFileName(session.Folder),
            session.Title.Length > 0 ? session.Title : Path.GetFileName(session.Folder),
            session.StartedAt,
            session.EndedAt,
            (int)Math.Round(session.DurationSeconds),
            model,
            result.MarkdownPath,
            File.ReadAllText(result.MarkdownPath),
            result.Segments.Count,
            result.Segments.Select(segment => segment.Speaker).Distinct().ToList());
}
