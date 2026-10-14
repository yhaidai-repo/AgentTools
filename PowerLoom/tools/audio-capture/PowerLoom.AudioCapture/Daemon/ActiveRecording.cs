using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Daemon;

// The recording in progress: its recorder, folder and title.
public sealed class ActiveRecording
{
    private readonly SessionRecorder _recorder;

    private ActiveRecording(SessionRecorder recorder, string folder, string title)
    {
        _recorder = recorder;
        Folder = folder;
        Title = title;
        StartedAt = DateTimeOffset.Now;
    }

    public string Folder { get; }

    public string Title { get; }

    public DateTimeOffset StartedAt { get; }

    public static ActiveRecording Start(string title)
    {
        var folder = SessionFolders.NewSessionFolder(title);
        var recorder = new SessionRecorder(folder, echoCancellation: true);

        recorder.Start();

        return new ActiveRecording(recorder, folder, title);
    }

    public (RecordingSession Session, string Title) Stop()
    {
        var session = _recorder.Stop();

        _recorder.Dispose();

        return (session, Title);
    }
}
