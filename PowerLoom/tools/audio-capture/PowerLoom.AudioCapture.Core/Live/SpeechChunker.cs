using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Live;

// Cuts one channel's stream into chunks at pauses, so the live view can transcribe while the meeting goes on:
// a chunk ends after 0.7 s of silence once it holds 0.8 s of speech, or at 15 s; a stretch with no speech is dropped.
// Energy-based: a 20 ms frame is speech when its RMS is well above the channel's noise floor, which is tracked as the
// quietest recent level (a Bluetooth headset mic sits 40x below a loopback). Used from the channel's capture thread only.
public sealed class SpeechChunker(string speaker)
{
    private const int Rate = MonoResampler.WhisperRate;
    private const int FrameSamples = Rate / 50;
    private const double FrameSeconds = 0.02;
    private const float FloorRatio = 3f;
    private const float MinSpeechRms = 0.004f;
    private const float FloorRise = 1.0005f;
    private const float FloorStart = 0.02f;
    private const double MinSpeechSeconds = 0.8;
    private const double CutSilenceSeconds = 0.7;
    private const double MaxChunkSeconds = 15;
    private const double DropSilentAfterSeconds = 5;
    private const double FlushMinSpeechSeconds = 0.3;

    private readonly List<float> _buffer = new(Rate * 16);
    private readonly float[] _frame = new float[FrameSamples];
    private int _frameFill;
    private long _totalSamples;
    private long _chunkStartSample;
    private double _speechSeconds;
    private double _trailingSilenceSeconds;
    private float _noiseFloor = FloorStart;

    public event Action<SpeechChunk>? Chunk;

    public void Add(ReadOnlySpan<float> samples)
    {
        foreach (var sample in samples)
        {
            AddSample(sample);
        }
    }

    // The recording ended: what is left is a chunk if anyone spoke in it.
    public void Flush()
    {
        if (_speechSeconds >= FlushMinSpeechSeconds)
            Emit();
        else
            Reset();
    }

    private void AddSample(float sample)
    {
        _buffer.Add(sample);
        _frame[_frameFill++] = sample;
        _totalSamples++;

        if (_frameFill == FrameSamples)
            ClassifyFrame();
    }

    private void ClassifyFrame()
    {
        _frameFill = 0;

        if (IsSpeech(Rms(_frame)))
        {
            _speechSeconds += FrameSeconds;
            _trailingSilenceSeconds = 0;
        }
        else
            _trailingSilenceSeconds += FrameSeconds;

        Decide();
    }

    private void Decide()
    {
        var lengthSeconds = _buffer.Count / (double)Rate;

        if (_speechSeconds >= MinSpeechSeconds && (_trailingSilenceSeconds >= CutSilenceSeconds || lengthSeconds >= MaxChunkSeconds))
            Emit();
        else if (_speechSeconds == 0 && lengthSeconds >= DropSilentAfterSeconds)
            Reset();
    }

    private void Emit()
    {
        var chunk = new SpeechChunk(speaker, _buffer.ToArray(), TimeSpan.FromSeconds(_chunkStartSample / (double)Rate));

        Reset();
        Chunk?.Invoke(chunk);
    }

    private void Reset()
    {
        _chunkStartSample = _totalSamples;
        _buffer.Clear();
        _speechSeconds = 0;
        _trailingSilenceSeconds = 0;
    }

    // The floor follows the quietest frames: it drops at once on a quiet frame and creeps up slowly, so a long stretch of
    // talk doesn't become the new "silence".
    private bool IsSpeech(float rms)
    {
        _noiseFloor = Math.Min(_noiseFloor * FloorRise, rms);

        return rms >= Math.Max(MinSpeechRms, _noiseFloor * FloorRatio);
    }

    private static float Rms(ReadOnlySpan<float> frame)
    {
        double sum = 0;

        foreach (var sample in frame)
        {
            sum += sample * sample;
        }

        return (float)Math.Sqrt(sum / frame.Length);
    }
}
