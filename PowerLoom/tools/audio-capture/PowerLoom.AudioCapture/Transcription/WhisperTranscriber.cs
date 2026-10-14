using PowerLoom.AudioCapture.Models;
using Whisper.net;

namespace PowerLoom.AudioCapture.Transcription;

// Runs one ggml model over 16 kHz mono WAV files; the language is detected per window, so mixed speech works.
public sealed class WhisperTranscriber : IDisposable
{
    private readonly WhisperFactory _factory;
    private readonly TranscriptionOptions _options;

    public WhisperTranscriber(string modelPath, TranscriptionOptions options)
    {
        _factory = WhisperFactory.FromPath(modelPath);
        _options = options;
    }

    public async Task<List<TranscriptSegment>> TranscribeAsync(string wavPath, string speaker)
    {
        await using var processor = BuildProcessor();
        await using var wave = File.OpenRead(wavPath);

        var segments = new List<TranscriptSegment>();

        await foreach (var segment in processor.ProcessAsync(wave))
        {
            if (SpeechFilter.IsSpeech(segment, _options.NoSpeechThreshold))
                segments.Add(ToSegment(segment, speaker));
        }

        return segments;
    }

    public void Dispose() => _factory.Dispose();

    private static TranscriptSegment ToSegment(SegmentData segment, string speaker) =>
        new(speaker, segment.Start, segment.End, segment.Text.Trim(), segment.Language, segment.Probability, segment.NoSpeechProbability);

    private WhisperProcessor BuildProcessor()
    {
        var builder = _factory.CreateBuilder().WithLanguage("auto");

        if (_options.Prompt.Length > 0)
            builder = builder.WithPrompt(_options.Prompt);

        if (_options.NoContext)
            builder = builder.WithNoContext();

        return builder.Build();
    }
}
