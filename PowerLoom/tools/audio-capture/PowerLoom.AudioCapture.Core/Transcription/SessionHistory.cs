using System.Text.Json;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Transcription;

// Past sessions on disk: the newest transcribed one opens in the window at start.
public static class SessionHistory
{
    public static string? LatestTranscribedFolder()
    {
        if (!Directory.Exists(SessionFolders.Root))
            return null;

        return Directory.EnumerateDirectories(SessionFolders.Root)
            .Where(folder => File.Exists(TranscriptJsonOf(folder)))
            .OrderByDescending(Path.GetFileName)
            .FirstOrDefault();
    }

    public static List<TranscriptSegment> LoadSegments(string folder) =>
        JsonSerializer.Deserialize<List<TranscriptSegment>>(File.ReadAllText(TranscriptJsonOf(folder))) ?? [];

    public static string TitleOf(string folder)
    {
        var meetingFile = RecordingSession.FileOf(folder);
        var title = File.Exists(meetingFile) ? RecordingSession.Load(folder).Title : "";

        return title.Length > 0 ? title : Path.GetFileName(folder);
    }

    private static string TranscriptJsonOf(string folder) => Path.Combine(folder, "transcript.json");
}
