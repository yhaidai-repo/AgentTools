using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// With speakers (or a leaky headset) the mic hears the other side too; a mic segment that repeats what the system
// channel said at the same moment is that echo, not the user.
public static class EchoFilter
{
    private static readonly TimeSpan Window = TimeSpan.FromSeconds(4);
    private const double SimilarityThreshold = 0.5;

    public static List<TranscriptSegment> WithoutEcho(IReadOnlyList<TranscriptSegment> mic, IReadOnlyList<TranscriptSegment> system) =>
        mic.Where(segment => !IsEchoOf(segment, system)).ToList();

    public static bool IsEchoOf(TranscriptSegment candidate, IReadOnlyList<TranscriptSegment> system) =>
        system.Where(other => Overlaps(candidate, other)).Any(other => Similarity(candidate.Text, other.Text) >= SimilarityThreshold);

    private static bool Overlaps(TranscriptSegment a, TranscriptSegment b) =>
        a.Start <= b.End + Window && b.Start <= a.End + Window;

    // Share of the shorter segment's words that also appear in the other one.
    private static double Similarity(string a, string b)
    {
        var wordsA = Words(a);
        var wordsB = Words(b);

        if (wordsA.Count < 2 || wordsB.Count < 2)
            return 0;

        var shared = wordsA.Intersect(wordsB).Count();

        return (double)shared / Math.Min(wordsA.Count, wordsB.Count);
    }

    private static HashSet<string> Words(string text) =>
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(word => word.Trim('.', ',', '!', '?', ':', ';', '"', '\'', '-').ToLowerInvariant())
            .Where(word => word.Length > 0)
            .ToHashSet();
}
