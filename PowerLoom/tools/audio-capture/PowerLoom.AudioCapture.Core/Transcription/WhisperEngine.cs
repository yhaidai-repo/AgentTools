using PowerLoom.AudioCapture.Models;
using Whisper.net;

namespace PowerLoom.AudioCapture.Transcription;

// One loaded ggml model (kept on the GPU for the process's lifetime) that serves the live chunks and the final pass,
// one request at a time. The language is detected per window, so mixed speech works.
public sealed class WhisperEngine(string modelPath, TranscriptionOptions options) : IDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private WhisperFactory? _factory;

    public bool IsLoaded => _factory is not null;

    public Task LoadAsync() => Task.Run(() => _factory ??= WhisperFactory.FromPath(modelPath));

    public async Task<List<TranscriptSegment>> TranscribeWavAsync(string wavPath, string speaker)
    {
        await using var wave = File.OpenRead(wavPath);

        return await RunAsync(processor => processor.ProcessAsync(wave), speaker, TimeSpan.Zero);
    }

    public Task<List<TranscriptSegment>> TranscribeSamplesAsync(float[] samples, string speaker, TimeSpan offset) =>
        RunAsync(processor => processor.ProcessAsync(samples), speaker, offset);

    public void Dispose()
    {
        _factory?.Dispose();
        _gate.Dispose();
    }

    private async Task<List<TranscriptSegment>> RunAsync(Func<WhisperProcessor, IAsyncEnumerable<SegmentData>> process, string speaker, TimeSpan offset)
    {
        await _gate.WaitAsync();

        try
        {
            await LoadAsync();
            await using var processor = BuildProcessor();

            return await CollectAsync(process(processor), speaker, offset);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<List<TranscriptSegment>> CollectAsync(IAsyncEnumerable<SegmentData> segments, string speaker, TimeSpan offset)
    {
        var kept = new List<TranscriptSegment>();

        try
        {
            await foreach (var segment in segments)
            {
                if (SpeechFilter.IsSpeech(segment, options))
                    kept.Add(ToSegment(segment, speaker, offset));
            }
        }
        catch (WhisperProcessingException exception) when (IsSilence(exception))
        {
            // whisper.cpp can't pick a language on audio with no speech at all: an empty result, not an error.
        }

        return kept;
    }

    private static TranscriptSegment ToSegment(SegmentData segment, string speaker, TimeSpan offset) =>
        new(speaker, offset + segment.Start, offset + segment.End, segment.Text.Trim(), segment.Language, segment.Probability, segment.NoSpeechProbability);

    private static bool IsSilence(WhisperProcessingException exception) =>
        exception.Message.Contains("auto-detect language", StringComparison.OrdinalIgnoreCase);

    private WhisperProcessor BuildProcessor()
    {
        // WithProbabilities: without it every segment reports probability 0 and the no-speech filter has nothing to go on.
        var builder = _factory!.CreateBuilder().WithLanguage("auto").WithProbabilities();

        if (options.Prompt.Length > 0)
            builder = builder.WithPrompt(options.Prompt);

        if (options.NoContext)
            builder = builder.WithNoContext();

        return builder.Build();
    }
}
