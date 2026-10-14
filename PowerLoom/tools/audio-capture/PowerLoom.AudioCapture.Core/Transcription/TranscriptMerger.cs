using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// Both channels in one timeline: `[hh:mm:ss] Me: …` lines, one per turn (consecutive segments of one speaker).
public static class TranscriptMerger
{
    private const string TimeFormat = @"hh\:mm\:ss";

    public static IReadOnlyList<TranscriptSegment> Merge(IEnumerable<TranscriptSegment> mic, IEnumerable<TranscriptSegment> system) =>
        mic.Concat(system).Where(s => s.Text.Length > 0).OrderBy(s => s.Start).ToList();

    public static IReadOnlyList<TranscriptSegment> InTimeOrder(IEnumerable<TranscriptSegment> segments) =>
        segments.Where(s => s.Text.Length > 0).OrderBy(s => s.Start).ToList();

    public static string ToMarkdown(IReadOnlyList<TranscriptSegment> segments)
    {
        var lines = TranscriptTurns.From(segments).Select(turn => $"[{turn.Start.ToString(TimeFormat)}] {turn.Speaker}: {turn.Text}");

        return string.Join(Environment.NewLine, lines);
    }
}
