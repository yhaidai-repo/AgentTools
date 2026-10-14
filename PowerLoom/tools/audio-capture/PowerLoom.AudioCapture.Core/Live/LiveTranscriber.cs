using System.Threading.Channels;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Live;

// Transcribes chunks in arrival order on one worker and raises each segment as soon as it is known (provisional text;
// the final pass after the recording replaces it). Mic segments that repeat recent system-channel text are echo and dropped.
public sealed class LiveTranscriber
{
    private static readonly TimeSpan EchoMemory = TimeSpan.FromSeconds(30);
    private readonly Channel<SpeechChunk> _queue = Channel.CreateUnbounded<SpeechChunk>();
    private readonly List<TranscriptSegment> _recentSystem = [];
    private readonly Task _worker;
    private int _pending;

    public LiveTranscriber(WhisperEngine engine)
    {
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

            foreach (var segment in segments)
            {
                Publish(segment);
            }
        }
        catch (Exception exception)
        {
            Log.Error($"Live chunk at {chunk.Start:hh\\:mm\\:ss} ({chunk.Speaker}) failed", exception);
        }
    }

    private void Publish(TranscriptSegment segment)
    {
        if (segment.Speaker == SystemChannelName)
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

    private static string SystemChannelName => Recording.SessionRecorder.SystemChannel;
}
