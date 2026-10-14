using PowerLoom.AudioCapture.Live;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Daemon;

// The recording in progress: its recorder, folder and title, the live path (chunkers per channel → live transcriber),
// the voices heard so far and every live segment in the labels the user sees now.
public sealed class ActiveRecording
{
    private readonly SessionRecorder _recorder;
    private readonly Dictionary<string, SpeechChunker> _chunkers;
    private readonly LiveTranscriber _live;
    private readonly Lock _sync = new();
    private readonly List<TranscriptSegment> _segments = [];
    private readonly Dictionary<string, string> _relabels = [];

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

        if (speakers is not null)
            speakers.Relabeled += OnRelabeled;
    }

    public event Action<TranscriptSegment>? LiveSegment;

    // A voice's label changed (named, or merged into another voice): old → new; the collected segments already follow.
    public event Action<string, string>? SpeakerRelabeled;

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

    public bool RenameSpeaker(string oldLabel, string name) => Speakers?.Rename(oldLabel, name) ?? false;

    public string? RemoveSpeaker(string label) => Speakers?.Remove(label);

    // The user moves what one bubble holds (the system-channel segments between start and end) to another voice.
    public void ReassignSegments(TimeSpan start, TimeSpan end, string label)
    {
        lock (_sync)
        {
            for (var i = 0; i < _segments.Count; i++)
            {
                if (_segments[i].Channel == SessionRecorder.SystemChannel && _segments[i].Start >= start && _segments[i].Start <= end)
                    _segments[i] = _segments[i] with { Speaker = label };
            }
        }
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
            var labeled = _relabels.TryGetValue(segment.Speaker, out var name) ? segment with { Speaker = name } : segment;

            _segments.Add(labeled);

            return labeled;
        }
    }

    private void OnRelabeled(string oldLabel, string name)
    {
        lock (_sync)
        {
            _relabels[oldLabel] = name;

            foreach (var key in _relabels.Where(r => r.Value == oldLabel).Select(r => r.Key).ToList())
            {
                _relabels[key] = name;
            }

            for (var i = 0; i < _segments.Count; i++)
            {
                if (_segments[i].Speaker == oldLabel)
                    _segments[i] = _segments[i] with { Speaker = name };
            }
        }

        SpeakerRelabeled?.Invoke(oldLabel, name);
    }
}
