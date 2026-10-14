using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Recording;

// One meeting: the default microphone (me) and the default output's loopback (the others) as two 16 kHz mono WAV files.
public sealed class SessionRecorder(string folder, bool echoCancellation) : IDisposable
{
    private readonly ChannelRecorder _mic = new(CaptureDevices.Microphone(echoCancellation), Path.Combine(folder, "mic.wav"));
    private readonly ChannelRecorder _system = new(CaptureDevices.SystemLoopback(), Path.Combine(folder, "system.wav"));
    // Loopback delivers nothing while no app renders audio; a silent stream keeps the timeline continuous.
    private readonly SilencePlayer _silence = new();
    private DateTimeOffset _startedAt;

    public void Start()
    {
        Directory.CreateDirectory(folder);

        _startedAt = DateTimeOffset.Now;
        Console.WriteLine($"Mic: {_mic.Device}; system: {_system.Device}");
        _silence.Start();
        _system.Start();
        _mic.Start();
    }

    public RecordingSession Stop()
    {
        _mic.Stop();
        _system.Stop();
        _silence.Stop();

        var session = new RecordingSession(folder, _startedAt, DateTimeOffset.Now, _mic.Path, _system.Path);

        RecordingSession.Save(session);

        return session;
    }

    public void Dispose()
    {
        _mic.Dispose();
        _system.Dispose();
        _silence.Dispose();
    }
}
