using System.Diagnostics;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Transcription;

// The final pass: each channel's WAV cut into speech chunks (silence never reaches Whisper), transcribed through the
// engine, merged into one timeline, written as transcript.md / transcript.json next to the audio.
public sealed class SessionTranscriber(WhisperEngine engine, Action<string> log)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public async Task<TranscriptResult> TranscribeAsync(string folder)
    {
        var mic = await TranscribeChannelAsync(Path.Combine(folder, "mic.wav"), SessionRecorder.MicChannel);
        var system = await TranscribeChannelAsync(Path.Combine(folder, "system.wav"), SessionRecorder.SystemChannel);
        var segments = TranscriptMerger.Merge(EchoFilter.WithoutEcho(mic, system), system);

        return Write(folder, segments);
    }

    private async Task<List<TranscriptSegment>> TranscribeChannelAsync(string wavPath, string speaker)
    {
        var audioSeconds = WavDuration.Seconds(wavPath);
        var watch = Stopwatch.StartNew();
        var chunks = WavChunks.Read(wavPath, speaker);
        var segments = new List<TranscriptSegment>();

        foreach (var chunk in chunks)
        {
            segments.AddRange(await engine.TranscribeSamplesAsync(chunk.Samples, speaker, chunk.Start));
        }

        log($"{speaker}: {audioSeconds:F0} s of audio, {chunks.Count} speech chunks, in {watch.Elapsed.TotalSeconds:F1} s ({audioSeconds / watch.Elapsed.TotalSeconds:F1}x realtime), {segments.Count} segments");

        return segments;
    }

    private static TranscriptResult Write(string folder, IReadOnlyList<TranscriptSegment> segments)
    {
        var markdownPath = Path.Combine(folder, "transcript.md");
        var jsonPath = Path.Combine(folder, "transcript.json");

        File.WriteAllText(markdownPath, TranscriptMerger.ToMarkdown(segments));
        File.WriteAllText(jsonPath, JsonSerializer.Serialize(segments, Json));

        return new TranscriptResult(markdownPath, jsonPath, segments);
    }
}
