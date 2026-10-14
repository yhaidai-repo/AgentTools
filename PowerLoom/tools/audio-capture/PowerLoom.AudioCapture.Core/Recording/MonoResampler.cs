using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace PowerLoom.AudioCapture.Recording;

// Device audio (any rate, any channel count, PCM or float) → mono float samples at the target rate.
public sealed class MonoResampler
{
    public const int WhisperRate = 16000;

    private readonly BufferedWaveProvider _buffer;
    private readonly ISampleProvider _output;
    private byte[] _pushed = [];

    public MonoResampler(WaveFormat deviceFormat, int targetRate)
    {
        _buffer = new BufferedWaveProvider(deviceFormat, TimeSpan.FromSeconds(10))
        {
            ReadFully = false,
            DiscardOnBufferOverflow = true,
        };

        var mono = ToMono(_buffer.ToSampleProvider());

        _output = new WdlResamplingSampleProvider(mono, targetRate);
    }

    public void Push(ReadOnlySpan<byte> bytes)
    {
        if (_pushed.Length < bytes.Length)
            _pushed = new byte[bytes.Length];

        bytes.CopyTo(_pushed);
        _buffer.AddSamples(_pushed, 0, bytes.Length);
    }

    public int Read(float[] samples) => _output.Read(samples);

    private static ISampleProvider ToMono(ISampleProvider source) =>
        source.WaveFormat.Channels == 1 ? source : new MonoMixSampleProvider(source);
}
