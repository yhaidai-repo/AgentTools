using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Speakers;

// The named voices (voices.json in the home): a name gets one print per recording the user named it in, and a new
// recording's voice is matched against all of them.
public sealed class VoiceStore
{
    // Same voice across meetings and devices scores about 0.6–0.9; different people 0.0–0.4 (WeSpeaker ResNet34).
    public const double MatchThreshold = 0.55;

    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    private readonly Lock _sync = new();
    private readonly List<VoicePrint> _prints;

    public VoiceStore()
    {
        _prints = File.Exists(FilePath) ? JsonSerializer.Deserialize<List<VoicePrint>>(File.ReadAllText(FilePath), Json) ?? [] : [];
    }

    public static string FilePath => Path.Combine(AppPaths.Home, "voices.json");

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

    public string? Match(float[] embedding) => Best(embedding) is { Score: >= MatchThreshold } best ? best.Name : null;

    // The closest stored voice and how close (for the log), whatever the threshold says.
    public (string Name, double Score)? Best(float[] embedding)
    {
        lock (_sync)
        {
            if (_prints.Count == 0)
                return null;

            return _prints.Select(print => (print.Name, Score: VoiceEmbedder.Similarity(print.Embedding, embedding)))
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
    }

    public void Remove(string name)
    {
        lock (_sync)
        {
            _prints.RemoveAll(print => print.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));
            File.WriteAllText(FilePath, JsonSerializer.Serialize(_prints, Json));
        }
    }
}
