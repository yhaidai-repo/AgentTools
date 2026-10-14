using System.Text.Json;

namespace PowerLoom.AudioCapture.Models;

// meeting.json of a session folder (Title since stage 2b; older sessions have none).
public sealed record RecordingSession(
    string Folder,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    string MicPath,
    string SystemPath,
    string Title = "")
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public double DurationSeconds => (EndedAt - StartedAt).TotalSeconds;

    public static string FileOf(string folder) => Path.Combine(folder, "meeting.json");

    public static void Save(RecordingSession session) =>
        File.WriteAllText(FileOf(session.Folder), JsonSerializer.Serialize(session, Json));

    public static RecordingSession Load(string folder) =>
        JsonSerializer.Deserialize<RecordingSession>(File.ReadAllText(FileOf(folder)), Json)
        ?? throw new InvalidOperationException($"Unreadable {FileOf(folder)}");
}
