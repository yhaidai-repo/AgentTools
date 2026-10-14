using System.Diagnostics;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// Transcribes both channels of a session folder and writes transcript-<model>.md / .json next to them.
public sealed class SessionTranscriber(string modelPath, TranscriptionOptions options, Action<string> log)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public async Task<TranscriptResult> TranscribeAsync(string folder, WhisperModel model)
    {
        using var transcriber = new WhisperTranscriber(modelPath, options);

        var mic = await TranscribeChannelAsync(transcriber, Path.Combine(folder, "mic.wav"), "Me");
        var system = await TranscribeChannelAsync(transcriber, Path.Combine(folder, "system.wav"), "Them");
        var segments = TranscriptMerger.Merge(EchoFilter.WithoutEcho(mic, system), system);

        return Write(folder, WhisperModels.Name(model), segments);
    }

    private async Task<List<TranscriptSegment>> TranscribeChannelAsync(WhisperTranscriber transcriber, string wavPath, string speaker)
    {
        var audioSeconds = WavDuration.Seconds(wavPath);
        var watch = Stopwatch.StartNew();
        var segments = await transcriber.TranscribeAsync(wavPath, speaker);

        log($"{speaker}: {audioSeconds:F0} s of audio in {watch.Elapsed.TotalSeconds:F1} s ({audioSeconds / watch.Elapsed.TotalSeconds:F1}x realtime), {segments.Count} segments");

        return segments;
    }

    private static TranscriptResult Write(string folder, string modelName, IReadOnlyList<TranscriptSegment> segments)
    {
        var markdownPath = Path.Combine(folder, $"transcript-{modelName}.md");
        var jsonPath = Path.Combine(folder, $"transcript-{modelName}.json");

        File.WriteAllText(markdownPath, TranscriptMerger.ToMarkdown(segments));
        File.WriteAllText(jsonPath, JsonSerializer.Serialize(segments, Json));

        return new TranscriptResult(markdownPath, jsonPath, segments);
    }
}
