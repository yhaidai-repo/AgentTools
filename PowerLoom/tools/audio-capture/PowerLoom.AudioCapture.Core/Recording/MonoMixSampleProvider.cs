using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// Averages every channel of a multi-channel source into one.
public sealed class MonoMixSampleProvider : ISampleProvider
{
    private readonly ISampleProvider _source;
    private readonly int _channels;
    private float[] _frame = [];

    public MonoMixSampleProvider(ISampleProvider source)
    {
        _source = source;
        _channels = source.WaveFormat.Channels;
        WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(source.WaveFormat.SampleRate, 1);
    }

    public WaveFormat WaveFormat { get; }

    public int Read(Span<float> buffer)
    {
        EnsureFrame(buffer.Length * _channels);

        var sourceRead = _source.Read(_frame.AsSpan(0, buffer.Length * _channels));
        var frames = sourceRead / _channels;

        for (var frame = 0; frame < frames; frame++)
        {
            buffer[frame] = Average(frame);
        }

        return frames;
    }

    private float Average(int frame)
    {
        float sum = 0;

        for (var channel = 0; channel < _channels; channel++)
        {
            sum += _frame[frame * _channels + channel];
        }

        return sum / _channels;
    }

    private void EnsureFrame(int length)
    {
        if (_frame.Length < length)
            _frame = new float[length];
    }
}
