using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// One WASAPI capture written as 16 kHz mono 16-bit PCM, the format Whisper reads.
public sealed class ChannelRecorder : IDisposable
{
    private readonly WasapiRecorder _capture;
    private readonly MonoResampler _resampler;
    private readonly WaveFileWriter _writer;
    private readonly LevelMeter _meter = new();
    private readonly float[] _samples = new float[16000];
    private readonly ManualResetEventSlim _stopped = new(false);

    public ChannelRecorder(WasapiRecorder capture, string path)
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);

        _capture = capture;
        _resampler = new MonoResampler(capture.WaveFormat, MonoResampler.WhisperRate);
        _writer = new WaveFileWriter(path, new WaveFormat(MonoResampler.WhisperRate, 16, 1));
        Path = path;

        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += (_, _) => _stopped.Set();
        _meter.Level += level => Level?.Invoke(level);
    }

    public event Action<float>? Level;

    // The resampled 16 kHz mono samples as they come (buffer and count), on the capture thread; consumers copy at once.
    public event Action<float[], int>? Samples;

    public string Path { get; }

    public string Device => _capture.DeviceFriendlyName;

    public void Start() => _capture.StartRecording();

    public void Stop()
    {
        _capture.StopRecording();
        _stopped.Wait(TimeSpan.FromSeconds(5));
        _writer.Flush();
    }

    public void Dispose()
    {
        _capture.Dispose();
        _writer.Dispose();
        _stopped.Dispose();
    }

    private void OnDataAvailable(ReadOnlySpan<byte> data, AudioClientBufferFlags flags, long devicePosition, long qpcPosition)
    {
        _resampler.Push(data);

        var read = _resampler.Read(_samples);

        while (read > 0)
        {
            _writer.WriteSamples(_samples, 0, read);
            _meter.Add(_samples.AsSpan(0, read));
            Samples?.Invoke(_samples, read);
            read = _resampler.Read(_samples);
        }
    }
}
