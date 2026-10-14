using System.Text.Json;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Pipeline;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Speakers;

// The user names a voice of a session: the label changes in speakers.json, transcript.json / .md and, when PowerLoom
// hasn't taken it yet, the inbox file; the voice print is stored under the name for the next meetings.
public sealed class SpeakerRenamer(VoiceStore store, ToolSettings settings)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public bool Rename(string folder, string oldLabel, string newName)
    {
        var speakers = SessionSpeakers.Load(folder);
        var speaker = speakers.FirstOrDefault(s => s.Label == oldLabel);
        var name = newName.Trim();

        if (speaker is null || name.Length == 0 || name == oldLabel)
            return false;

        SessionSpeakers.Save(folder, speakers.Select(s => s == speaker ? s with { Label = name, Known = true } : s).ToList());
        Remember(speaker, name);
        RewriteTranscript(folder, oldLabel, name);

        return true;
    }

    private void Remember(SpeakerInfo speaker, string name)
    {
        if (speaker.Embedding.Length > 0)
            store.Add(name, speaker.Embedding);
    }

    private void RewriteTranscript(string folder, string oldLabel, string name)
    {
        var segments = SessionHistory.LoadSegments(folder).Select(s => s.Speaker == oldLabel ? s with { Speaker = name } : s).ToList();
        var markdownPath = Path.Combine(folder, "transcript.md");

        File.WriteAllText(SessionHistory.TranscriptJsonOf(folder), JsonSerializer.Serialize(segments, Json));
        File.WriteAllText(markdownPath, TranscriptMerger.ToMarkdown(segments));
        RewriteInbox(folder, new TranscriptResult(markdownPath, SessionHistory.TranscriptJsonOf(folder), segments));
    }

    // Only while the file still waits in the inbox; once PowerLoom took it, the task's transcript is PowerLoom's.
    private void RewriteInbox(string folder, TranscriptResult result)
    {
        var inboxFile = Path.Combine(settings.InboxPath, Path.GetFileName(folder) + ".json");

        if (!File.Exists(inboxFile) || !File.Exists(RecordingSession.FileOf(folder)))
            return;

        InboxWriter.Write(settings.InboxPath, MeetingImports.From(RecordingSession.Load(folder), result, settings.Model));
    }
}
