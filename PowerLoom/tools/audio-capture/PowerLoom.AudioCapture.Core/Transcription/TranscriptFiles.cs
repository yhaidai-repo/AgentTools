using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// transcript.md and transcript.json of a session folder.
public static class TranscriptFiles
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static TranscriptResult Write(string folder, IReadOnlyList<TranscriptSegment> segments)
    {
        var markdownPath = Path.Combine(folder, "transcript.md");
        var jsonPath = SessionHistory.TranscriptJsonOf(folder);

        File.WriteAllText(markdownPath, TranscriptMerger.ToMarkdown(segments));
        File.WriteAllText(jsonPath, JsonSerializer.Serialize(segments, Json));

        return new TranscriptResult(markdownPath, jsonPath, segments);
    }
}
