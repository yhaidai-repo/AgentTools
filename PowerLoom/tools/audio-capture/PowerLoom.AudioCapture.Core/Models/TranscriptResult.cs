namespace PowerLoom.AudioCapture.Models;

public sealed record TranscriptResult(string MarkdownPath, string JsonPath, IReadOnlyList<TranscriptSegment> Segments);
