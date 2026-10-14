using PowerLoom.AudioCapture.Live;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Daemon;

// The recording in progress: its recorder, folder and title, and the live path (chunkers per channel → live transcriber).
public sealed class ActiveRecording
{
    private readonly SessionRecorder _recorder;
    private readonly Dictionary<string, SpeechChunker> _chunkers;
    private readonly LiveTranscriber _live;

    private ActiveRecording(SessionRecorder recorder, string folder, string title, WhisperEngine engine)
    {
        _recorder = recorder;
        _chunkers = new Dictionary<string, SpeechChunker>
        {
            [SessionRecorder.MicChannel] = new SpeechChunker(SessionRecorder.MicChannel),
            [SessionRecorder.SystemChannel] = new SpeechChunker(SessionRecorder.SystemChannel),
        };
        _live = new LiveTranscriber(engine);
        Folder = folder;
        Title = title;
        StartedAt = DateTimeOffset.Now;

        foreach (var chunker in _chunkers.Values)
        {
            chunker.Chunk += _live.Enqueue;
        }

        _recorder.Samples += (channel, samples, count) => _chunkers[channel].Add(samples.AsSpan(0, count));
        _live.Segment += segment => LiveSegment?.Invoke(segment);
    }

    public event Action<TranscriptSegment>? LiveSegment;

    public string Folder { get; }

    public string Title { get; }

    public DateTimeOffset StartedAt { get; }

    public static ActiveRecording Start(string title, CaptureSelection devices, WhisperEngine engine, Action<string, float> onLevel)
    {
        var folder = SessionFolders.NewSessionFolder(title);
        var recorder = new SessionRecorder(folder, title, devices, echoCancellation: true);
        var recording = new ActiveRecording(recorder, folder, title, engine);

        recorder.Level += onLevel;
        recorder.Start();

        return recording;
    }

    // Stops the capture, lets the last chunks through the live path, and returns the session for the final pass.
    public async Task<RecordingSession> StopAsync()
    {
        var session = _recorder.Stop();

        _recorder.Dispose();

        foreach (var chunker in _chunkers.Values)
        {
            chunker.Flush();
        }

        await _live.CompleteAsync();

        return session;
    }
}
