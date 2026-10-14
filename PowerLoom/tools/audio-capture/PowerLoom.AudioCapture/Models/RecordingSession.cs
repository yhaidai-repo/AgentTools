using System.Text.Json;

namespace PowerLoom.AudioCapture.Models;

// meeting.json of a session folder.
public sealed record RecordingSession(
    string Folder,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    string MicPath,
    string SystemPath)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public double DurationSeconds => (EndedAt - StartedAt).TotalSeconds;

    public static string FileOf(string folder) => Path.Combine(folder, "meeting.json");

    public static void Save(RecordingSession session) =>
        File.WriteAllText(FileOf(session.Folder), JsonSerializer.Serialize(session, Json));
}
