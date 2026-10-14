using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Speakers;

// speakers.json of a session folder.
public static class SessionSpeakers
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static string FileOf(string folder) => Path.Combine(folder, "speakers.json");

    public static List<SpeakerInfo> Load(string folder) =>
        File.Exists(FileOf(folder)) ? JsonSerializer.Deserialize<List<SpeakerInfo>>(File.ReadAllText(FileOf(folder)), Json) ?? [] : [];

    public static void Save(string folder, IReadOnlyList<SpeakerInfo> speakers) =>
        File.WriteAllText(FileOf(folder), JsonSerializer.Serialize(speakers, Json));
}
