using PowerLoom.AudioCapture.Live;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Daemon;

// The recording in progress: its recorder, folder and title, the live path (chunkers per channel → live transcriber)
// and the voices heard so far.
public sealed class ActiveRecording
{
    private readonly SessionRecorder _recorder;
    private readonly Dictionary<string, SpeechChunker> _chunkers;
    private readonly LiveTranscriber _live;
    private readonly Lock _sync = new();
    private readonly List<TranscriptSegment> _segments = [];
    private readonly Dictionary<string, string> _renames = [];

    private ActiveRecording(SessionRecorder recorder, string folder, string title, WhisperEngine engine, LiveSpeakers? speakers)
    {
        _recorder = recorder;
        _chunkers = new Dictionary<string, SpeechChunker>
        {
            [SessionRecorder.MicChannel] = new SpeechChunker(SessionRecorder.MicChannel),
            [SessionRecorder.SystemChannel] = new SpeechChunker(SessionRecorder.SystemChannel),
        };
        _live = new LiveTranscriber(engine, speakers);
        Speakers = speakers;
        Folder = folder;
        Title = title;
        StartedAt = DateTimeOffset.Now;

        foreach (var chunker in _chunkers.Values)
        {
            chunker.Chunk += _live.Enqueue;
        }

        _recorder.Samples += (channel, samples, count) => _chunkers[channel].Add(samples.AsSpan(0, count));
        _live.Segment += segment => LiveSegment?.Invoke(Collect(segment));
    }

    public event Action<TranscriptSegment>? LiveSegment;

    public LiveSpeakers? Speakers { get; }

    public string Folder { get; }

    public string Title { get; }

    public DateTimeOffset StartedAt { get; }

    // Everything said so far, in the labels the user sees now: the transcript of the meeting once it stops.
    public IReadOnlyList<TranscriptSegment> Segments
    {
        get
        {
            lock (_sync)
            {
                return TranscriptMerger.InTimeOrder(_segments);
            }
        }
    }

    public bool RenameSpeaker(string oldLabel, string name)
    {
        if (Speakers is null || !Speakers.Rename(oldLabel, name))
            return false;

        lock (_sync)
        {
            _renames[oldLabel] = name.Trim();
            Relabel(oldLabel, name.Trim());
        }

        return true;
    }

    public static ActiveRecording Start(string title, CaptureSelection devices, WhisperEngine engine, LiveSpeakers? speakers, Action<string, float> onLevel)
    {
        var folder = SessionFolders.NewSessionFolder(title);
        var recorder = new SessionRecorder(folder, title, devices, echoCancellation: true);
        var recording = new ActiveRecording(recorder, folder, title, engine, speakers);

        recorder.Level += onLevel;
        recorder.Start();

        return recording;
    }

    // Stops the capture, lets the last chunks through the live path, keeps the live voices, and returns the session.
    public async Task<RecordingSession> StopAsync()
    {
        var session = _recorder.Stop();

        _recorder.Dispose();

        foreach (var chunker in _chunkers.Values)
        {
            chunker.Flush();
        }

        await _live.CompleteAsync();

        if (Speakers is not null)
            SessionSpeakers.Save(Folder, Speakers.Snapshot());

        return session;
    }

    private TranscriptSegment Collect(TranscriptSegment segment)
    {
        lock (_sync)
        {
            var labeled = _renames.TryGetValue(segment.Speaker, out var name) ? segment with { Speaker = name } : segment;

            _segments.Add(labeled);

            return labeled;
        }
    }

    private void Relabel(string oldLabel, string name)
    {
        for (var i = 0; i < _segments.Count; i++)
        {
            if (_segments[i].Speaker == oldLabel)
                _segments[i] = _segments[i] with { Speaker = name };
        }
    }
}
