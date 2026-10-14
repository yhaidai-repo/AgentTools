using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Pipeline;

public static class MeetingImports
{
    public const string SourceName = "audio-capture";

    public static MeetingImport From(RecordingSession session, string title, TranscriptResult result, string model) =>
        new(
            SourceName,
            Path.GetFileName(session.Folder),
            title,
            session.StartedAt,
            session.EndedAt,
            (int)Math.Round(session.DurationSeconds),
            model,
            result.MarkdownPath,
            File.ReadAllText(result.MarkdownPath),
            result.Segments.Count);
}
