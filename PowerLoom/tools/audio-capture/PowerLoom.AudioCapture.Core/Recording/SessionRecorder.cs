using NAudio.CoreAudioApi;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Recording;

// One meeting: the default microphone (me) and the default output's loopback (the others) as two 16 kHz mono WAV files.
public sealed class SessionRecorder : IDisposable
{
    public const string MicChannel = "Me";
    public const string SystemChannel = "Them";

    private readonly string _folder;
    private readonly string _title;
    private readonly ChannelRecorder _mic;
    private readonly ChannelRecorder _system;
    // Loopback delivers nothing while no app renders audio on its device; a silent stream there keeps the timeline continuous.
    private readonly SilencePlayer _silence;
    private DateTimeOffset _startedAt;

    public SessionRecorder(string folder, string title, CaptureSelection devices, bool echoCancellation)
    {
        _folder = folder;
        _title = title;
        var output = CaptureDevices.Choose(DataFlow.Render, devices.SystemDevice);

        _mic = new ChannelRecorder(CaptureDevices.Microphone(devices.MicDevice, echoCancellation), Path.Combine(folder, "mic.wav"));
        _system = new ChannelRecorder(CaptureDevices.SystemLoopback(output), Path.Combine(folder, "system.wav"));
        _silence = new SilencePlayer(output);

        _mic.Level += level => Level?.Invoke(MicChannel, level);
        _system.Level += level => Level?.Invoke(SystemChannel, level);
        _mic.Samples += (samples, count) => Samples?.Invoke(MicChannel, samples, count);
        _system.Samples += (samples, count) => Samples?.Invoke(SystemChannel, samples, count);
    }

    // Loudness 0..1 of a channel, about 20 times a second while recording (raised on the capture threads).
    public event Action<string, float>? Level;

    // A channel's 16 kHz mono samples (buffer and count) as they come, on that channel's capture thread.
    public event Action<string, float[], int>? Samples;

    public void Start()
    {
        Directory.CreateDirectory(_folder);

        _startedAt = DateTimeOffset.Now;
        Log.Info($"Mic: {_mic.Device}; system: {_system.Device}");
        _silence.Start();
        _system.Start();
        _mic.Start();
    }

    public RecordingSession Stop()
    {
        _mic.Stop();
        _system.Stop();
        _silence.Stop();

        var session = new RecordingSession(_folder, _startedAt, DateTimeOffset.Now, _mic.Path, _system.Path, _title);

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
