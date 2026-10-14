using System.Text.Json;

namespace PowerLoom.AudioCapture.Speakers;

// How two voice prints compare. Raw cosine of this embedding model crowds every voice into 0.3–0.9 (two strangers
// scored 0.78 on 2026-10-14); subtracting the mean of all prints ever seen spreads them out (strangers mostly below
// 0.4, the same voice 0.45–0.9). The mean (voice-space.json in the home) grows with every print; until enough are
// seen the raw cosine with a strict floor is used.
public sealed class VoiceSpace
{
    private const int MinPopulation = 8;
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };
    private readonly Lock _sync = new();
    private float[] _mean;
    private int _count;

    public VoiceSpace()
    {
        var saved = File.Exists(FilePath) ? JsonSerializer.Deserialize<Saved>(File.ReadAllText(FilePath), Json) : null;

        _mean = saved?.Mean ?? [];
        _count = saved?.Count ?? 0;
    }

    public static string FilePath => Path.Combine(AppPaths.Home, "voice-space.json");

    public bool IsCentered => _count >= MinPopulation;

    // Thresholds for "the same voice" (centred / raw). Strangers reached 0.51 against a stored profile on 2026-10-14,
    // so a profile needs 0.6; joining a voice of the running meeting 0.55; a short stretch may still join at 0.35
    // (it can't open a voice); two voices merge at 0.6; a live voice is matched to the final pass's cluster at 0.5.
    public double StoredMatch => IsCentered ? 0.6 : 0.85;

    public double SameInMeeting => IsCentered ? 0.55 : 0.8;

    public double ShortJoin => IsCentered ? 0.35 : 0.7;

    public double Merge => IsCentered ? 0.6 : 0.85;

    public double LiveToFinal => IsCentered ? 0.5 : 0.75;

    public void Observe(float[] embedding)
    {
        lock (_sync)
        {
            var unit = Unit(embedding);

            if (_mean.Length != unit.Length)
            {
                _mean = new float[unit.Length];
                _count = 0;
            }

            for (var i = 0; i < unit.Length; i++)
            {
                _mean[i] = (_mean[i] * _count + unit[i]) / (_count + 1);
            }

            _count++;
            File.WriteAllText(FilePath, JsonSerializer.Serialize(new Saved(_mean, _count), Json));
        }
    }

    public double Similarity(float[] a, float[] b)
    {
        lock (_sync)
        {
            return IsCentered && _mean.Length == a.Length && _mean.Length == b.Length
                ? VoiceEmbedder.Similarity(Centered(a), Centered(b))
                : VoiceEmbedder.Similarity(a, b);
        }
    }

    private float[] Centered(float[] embedding)
    {
        var unit = Unit(embedding);

        for (var i = 0; i < unit.Length; i++)
        {
            unit[i] -= _mean[i];
        }

        return unit;
    }

    private static float[] Unit(float[] embedding)
    {
        var norm = Math.Sqrt(embedding.Sum(x => (double)x * x));
        var unit = new float[embedding.Length];

        for (var i = 0; i < embedding.Length; i++)
        {
            unit[i] = norm == 0 ? 0 : (float)(embedding[i] / norm);
        }

        return unit;
    }

    private sealed record Saved(float[] Mean, int Count);
}
