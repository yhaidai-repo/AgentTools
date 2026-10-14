using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Pipeline;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Speakers;

// The user names a voice of a session: the label changes in speakers.json, transcript.json / .md and, when PowerLoom
// hasn't taken it yet, the inbox file; the voice print is stored under the name for the next meetings.
public sealed class SpeakerRenamer(VoiceStore store, ToolSettings settings)
{
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

    // After Stop: the system-channel segments of one bubble (between start and end) move to another voice; the voice's
    // print learns from the bubble's audio when it is long enough to carry one.
    public bool Reassign(string folder, TimeSpan start, TimeSpan end, string label, VoiceEmbedder? embedder)
    {
        var segments = SessionHistory.LoadSegments(folder);
        var moved = segments.Select(s => IsInBubble(s, start, end) ? s with { Speaker = label.Trim() } : s).ToList();

        if (moved.SequenceEqual(segments))
            return false;

        WriteTranscript(folder, moved);
        Learn(folder, start, end, label.Trim(), embedder);

        return true;
    }

    // After Stop: a voice made by mistake is folded into the closest other voice of the session (by print; the one with
    // the most speech when prints are missing). Returns the voice it went to; stored profiles stay as they are.
    public string? Remove(string folder, string label)
    {
        var speakers = SessionSpeakers.Load(folder);
        var gone = speakers.FirstOrDefault(s => s.Label == label);
        var into = gone is null ? null : ClosestOther(speakers, gone);

        if (gone is null || into is null)
            return null;

        SessionSpeakers.Save(folder, speakers.Where(s => s != gone).Select(s => s == into ? s with { Seconds = s.Seconds + gone.Seconds } : s).ToList());
        RewriteTranscript(folder, label, into.Label);

        return into.Label;
    }

    private SpeakerInfo? ClosestOther(List<SpeakerInfo> speakers, SpeakerInfo gone)
    {
        var others = speakers.Where(s => s != gone).ToList();

        if (gone.Embedding.Length == 0 || others.All(s => s.Embedding.Length == 0))
            return others.MaxBy(s => s.Seconds);

        return others.Where(s => s.Embedding.Length > 0).MaxBy(s => store.Space.Similarity(s.Embedding, gone.Embedding));
    }

    private static bool IsInBubble(TranscriptSegment segment, TimeSpan start, TimeSpan end) =>
        segment.ChannelOrSpeaker == Recording.SessionRecorder.SystemChannel && segment.Start >= start && segment.Start <= end;

    private void Learn(string folder, TimeSpan start, TimeSpan end, string label, VoiceEmbedder? embedder)
    {
        if (embedder is null || (end - start).TotalSeconds < 3 || label.StartsWith("Speaker ", StringComparison.Ordinal))
            return;

        var samples = WavSamples.ReadAll(Path.Combine(folder, "system.wav"));
        var from = Math.Clamp((int)(start.TotalSeconds * Recording.MonoResampler.WhisperRate), 0, samples.Length);
        var to = Math.Clamp((int)(end.TotalSeconds * Recording.MonoResampler.WhisperRate), from, samples.Length);
        var embedding = embedder.Embed(samples[from..to]);

        if (embedding is not null)
            store.Add(label, embedding);
    }

    private void Remember(SpeakerInfo speaker, string name)
    {
        if (speaker.Embedding.Length > 0)
            store.Add(name, speaker.Embedding);
    }

    private void RewriteTranscript(string folder, string oldLabel, string name) =>
        WriteTranscript(folder, SessionHistory.LoadSegments(folder).Select(s => s.Speaker == oldLabel ? s with { Speaker = name } : s).ToList());

    private void WriteTranscript(string folder, IReadOnlyList<TranscriptSegment> segments) =>
        RewriteInbox(folder, TranscriptFiles.Write(folder, segments));

    // Only while the file still waits in the inbox; once PowerLoom took it, the task's transcript is PowerLoom's.
    private void RewriteInbox(string folder, TranscriptResult result)
    {
        var inboxFile = Path.Combine(settings.InboxPath, Path.GetFileName(folder) + ".json");

        if (!File.Exists(inboxFile) || !File.Exists(RecordingSession.FileOf(folder)))
            return;

        InboxWriter.Write(settings.InboxPath, MeetingImports.From(RecordingSession.Load(folder), result, settings.Model));
    }
}
