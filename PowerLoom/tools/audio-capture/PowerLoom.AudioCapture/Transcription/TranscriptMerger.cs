using System.Text;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// Both channels in one timeline: `[hh:mm:ss] Me: …` lines, consecutive lines of one speaker joined.
public static class TranscriptMerger
{
    public static IReadOnlyList<TranscriptSegment> Merge(IEnumerable<TranscriptSegment> mic, IEnumerable<TranscriptSegment> system) =>
        mic.Concat(system).Where(s => s.Text.Length > 0).OrderBy(s => s.Start).ToList();

    public static string ToMarkdown(IReadOnlyList<TranscriptSegment> segments)
    {
        var text = new StringBuilder();
        TranscriptSegment? previous = null;

        foreach (var segment in segments)
        {
            Append(text, segment, previous);
            previous = segment;
        }

        return text.ToString();
    }

    private static void Append(StringBuilder text, TranscriptSegment segment, TranscriptSegment? previous)
    {
        if (previous?.Speaker == segment.Speaker)
        {
            text.Append(' ').Append(segment.Text);

            return;
        }

        if (previous is not null)
            text.AppendLine();

        text.Append($"[{segment.Start:hh\\:mm\\:ss}] {segment.Speaker}: {segment.Text}");
    }
}
