using System.Threading.Channels;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Live;

// Transcribes chunks in arrival order on one worker and raises each segment as soon as it is known (provisional text).
// Mic segments that repeat recent system-channel text are echo and dropped. On the system channel every sentence long
// enough for a voice print is labelled by its own print, so a speaker change inside a chunk lands on the right voice;
// shorter sentences take the chunk's voice.
public sealed class LiveTranscriber
{
    private static readonly TimeSpan EchoMemory = TimeSpan.FromSeconds(30);
    private const double SentencePrintSeconds = 1.5;
    private readonly Channel<SpeechChunk> _queue = Channel.CreateUnbounded<SpeechChunk>();
    private readonly List<TranscriptSegment> _recentSystem = [];
    private readonly LiveSpeakers? _speakers;
    private readonly Task _worker;
    private int _pending;

    public LiveTranscriber(WhisperEngine engine, LiveSpeakers? speakers)
    {
        _speakers = speakers;
        _worker = Task.Run(() => WorkAsync(engine));
    }

    public event Action<TranscriptSegment>? Segment;

    public void Enqueue(SpeechChunk chunk)
    {
        Interlocked.Increment(ref _pending);
        _queue.Writer.TryWrite(chunk);
    }

    // Waits until every queued chunk is transcribed, then stops the worker.
    public async Task CompleteAsync()
    {
        while (Volatile.Read(ref _pending) > 0)
        {
            await Task.Delay(100);
        }

        _queue.Writer.Complete();
        await _worker;
    }

    private async Task WorkAsync(WhisperEngine engine)
    {
        await foreach (var chunk in _queue.Reader.ReadAllAsync())
        {
            await TranscribeAsync(engine, chunk);
            Interlocked.Decrement(ref _pending);
        }
    }

    private async Task TranscribeAsync(WhisperEngine engine, SpeechChunk chunk)
    {
        try
        {
            var segments = await engine.TranscribeSamplesAsync(chunk.Samples, chunk.Speaker, chunk.Start);
            var chunkLabel = segments.Count > 0 && IsSystem(chunk) ? _speakers?.LabelFor(chunk.Samples) : null;

            foreach (var segment in segments)
            {
                Publish(Labelled(segment, chunk, chunkLabel, segments.Count));
            }
        }
        catch (Exception exception)
        {
            Log.Error($"Live chunk at {chunk.Start:hh\\:mm\\:ss} ({chunk.Speaker}) failed", exception);
        }
    }

    // A chunk with several sentences: each long enough sentence is matched on its own among the voices heard so far
    // (never opening one); a chunk with one sentence is the sentence, judged once.
    private TranscriptSegment Labelled(TranscriptSegment segment, SpeechChunk chunk, string? chunkLabel, int sentences)
    {
        if (chunkLabel is null || sentences < 2)
            return chunkLabel is null ? segment : segment with { Speaker = chunkLabel };

        var own = SentenceLabel(segment, chunk);

        return segment with { Speaker = own ?? chunkLabel };
    }

    private string? SentenceLabel(TranscriptSegment segment, SpeechChunk chunk)
    {
        if ((segment.End - segment.Start).TotalSeconds < SentencePrintSeconds)
            return null;

        var from = Math.Clamp((int)((segment.Start - chunk.Start).TotalSeconds * MonoResampler.WhisperRate), 0, chunk.Samples.Length);
        var to = Math.Clamp((int)((segment.End - chunk.Start).TotalSeconds * MonoResampler.WhisperRate), from, chunk.Samples.Length);

        return _speakers?.LabelFor(chunk.Samples[from..to], mayOpen: false);
    }

    private static bool IsSystem(SpeechChunk chunk) => chunk.Speaker == SessionRecorder.SystemChannel;

    private void Publish(TranscriptSegment segment)
    {
        if (segment.Channel == SessionRecorder.SystemChannel)
            Remember(segment);
        else if (EchoFilter.IsEchoOf(segment, _recentSystem))
            return;

        Segment?.Invoke(segment);
    }

    private void Remember(TranscriptSegment segment)
    {
        _recentSystem.Add(segment);
        _recentSystem.RemoveAll(old => segment.End - old.End > EchoMemory);
    }
}
