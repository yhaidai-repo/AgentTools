namespace PowerLoom.AudioCapture.Recording;

// Loudness of a mono float stream as 0..1, reported once per window (50 ms at 16 kHz): the RMS scaled so speech fills the bar.
public sealed class LevelMeter
{
    private const int WindowSamples = 800;
    // Speech at a normal distance has an RMS around 0.05–0.2; 0.25 and above shows as full.
    private const float FullScaleRms = 0.25f;

    private double _sumOfSquares;
    private int _count;

    public event Action<float>? Level;

    public void Add(ReadOnlySpan<float> samples)
    {
        foreach (var sample in samples)
        {
            Accumulate(sample);
        }
    }

    private void Accumulate(float sample)
    {
        _sumOfSquares += sample * sample;
        _count++;

        if (_count >= WindowSamples)
            Flush();
    }

    private void Flush()
    {
        var rms = Math.Sqrt(_sumOfSquares / _count);

        _sumOfSquares = 0;
        _count = 0;
        Level?.Invoke((float)Math.Min(1, rms / FullScaleRms));
    }
}
