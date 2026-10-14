using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Speakers;

// The named voices (voices.json in the home): a name gets one print per recording the user named it in, and a new
// recording's voice is matched against all of them, in the voice space.
public sealed class VoiceStore(VoiceSpace space)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    private readonly Lock _sync = new();
    private readonly List<VoicePrint> _prints = Load();

    public static string FilePath => Path.Combine(AppPaths.Home, "voices.json");

    public VoiceSpace Space => space;

    public IReadOnlyList<string> Names
    {
        get
        {
            lock (_sync)
            {
                return _prints.Select(print => print.Name).Distinct().ToList();
            }
        }
    }

    public string? Match(float[] embedding) => Best(embedding) is { } best && best.Score >= space.StoredMatch ? best.Name : null;

    // The closest stored voice and how close (for the log), whatever the threshold says.
    public (string Name, double Score)? Best(float[] embedding)
    {
        lock (_sync)
        {
            if (_prints.Count == 0)
                return null;

            return _prints.Select(print => (print.Name, Score: space.Similarity(print.Embedding, embedding)))
                .OrderByDescending(candidate => candidate.Score)
                .First();
        }
    }

    public void Add(string name, float[] embedding)
    {
        lock (_sync)
        {
            _prints.Add(new VoicePrint(name.Trim(), embedding, DateTimeOffset.Now));
            File.WriteAllText(FilePath, JsonSerializer.Serialize(_prints, Json));
        }

        space.Observe(embedding);
    }

    public void Remove(string name)
    {
        lock (_sync)
        {
            _prints.RemoveAll(print => print.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));
            File.WriteAllText(FilePath, JsonSerializer.Serialize(_prints, Json));
        }
    }

    private static List<VoicePrint> Load() =>
        File.Exists(FilePath) ? JsonSerializer.Deserialize<List<VoicePrint>>(File.ReadAllText(FilePath), Json) ?? [] : [];
}
