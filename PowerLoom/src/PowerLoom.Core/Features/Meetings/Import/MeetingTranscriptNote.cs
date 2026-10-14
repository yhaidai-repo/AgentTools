using System.Text;
using PowerLoom.Features.Meetings.Models;

namespace PowerLoom.Features.Meetings.Import;

// The transcript as a note of the vault, `meetings/<sourceRef>-transcript.md`: the agent reads it with the doc tools,
// the user in Obsidian. The meeting notes the agent writes go next to it (powerloom-audio-capture, stage 4).
public static class MeetingTranscriptNote
{
    public const string Folder = "meetings";

    public static string PathOf(MeetingImport meeting) => $"{Folder}/{meeting.SourceRef}-transcript.md";

    public static string Render(MeetingImport meeting)
    {
        var text = new StringBuilder();

        text.AppendLine("---");
        text.AppendLine($"title: \"{meeting.Title.Replace("\"", "'")} – transcript\"");
        text.AppendLine("type: meeting-transcript");
        text.AppendLine($"source: {meeting.Source}");
        text.AppendLine($"started: {meeting.StartedAt:O}");
        text.AppendLine($"ended: {meeting.EndedAt:O}");
        text.AppendLine($"duration_min: {Math.Round(meeting.DurationSec / 60.0, 1)}");
        text.AppendLine($"speakers: [{string.Join(", ", meeting.Speakers.Select(Quoted))}]");
        text.AppendLine($"model: {meeting.Model ?? "unknown"}");
        text.AppendLine("---");
        text.AppendLine($"# {meeting.Title} – transcript");
        text.AppendLine();
        text.AppendLine(meeting.Transcript.Trim());

        return text.ToString();
    }

    private static string Quoted(string speaker) => $"\"{speaker.Replace("\"", "'")}\"";
}
