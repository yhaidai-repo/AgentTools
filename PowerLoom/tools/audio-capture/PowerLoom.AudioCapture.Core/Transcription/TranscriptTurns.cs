using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

public static class TranscriptTurns
{
    public static List<TranscriptTurn> From(IEnumerable<TranscriptSegment> segments)
    {
        var turns = new List<TranscriptTurn>();

        foreach (var segment in segments)
        {
            Append(turns, segment);
        }

        return turns;
    }

    private static void Append(List<TranscriptTurn> turns, TranscriptSegment segment)
    {
        var last = turns.LastOrDefault();

        if (last is null || last.Speaker != segment.Speaker)
        {
            turns.Add(new TranscriptTurn(segment.Speaker, segment.Start, segment.End, segment.Text));

            return;
        }

        turns[^1] = last with { End = segment.End, Text = last.Text + " " + segment.Text };
    }
}
