using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Speakers;

// Turns the diarizer's spans into labels on the system channel's segments: a segment belongs to the voice it overlaps
// most; each voice gets a stored name when its print matches one, else "Speaker n" in order of first appearance.
public static class SpeakerLabeling
{
    private const double MaxPrintSeconds = 20;

    public static (List<TranscriptSegment> Segments, List<SpeakerInfo> Speakers) Label(
        IReadOnlyList<TranscriptSegment> segments, IReadOnlyList<SpeakerSpan> spans, float[] samples, VoiceEmbedder embedder, VoiceStore store)
    {
        var speakers = DescribeVoices(spans, samples, embedder, store);
        var labels = speakers.ToDictionary(speaker => speaker.Index, speaker => speaker.Label);
        var labeled = segments.Select(segment => Relabel(segment, spans, labels)).ToList();

        return (labeled, speakers);
    }

    private static List<SpeakerInfo> DescribeVoices(IReadOnlyList<SpeakerSpan> spans, float[] samples, VoiceEmbedder embedder, VoiceStore store)
    {
        var speakers = new List<SpeakerInfo>();
        var unnamed = 0;

        foreach (var group in spans.GroupBy(span => span.Index).OrderBy(group => group.Min(span => span.Start)))
        {
            speakers.Add(Describe(group.Key, group.ToList(), samples, embedder, store, ref unnamed));
        }

        return speakers;
    }

    private static SpeakerInfo Describe(int index, List<SpeakerSpan> spans, float[] samples, VoiceEmbedder embedder, VoiceStore store, ref int unnamed)
    {
        var seconds = spans.Sum(span => (span.End - span.Start).TotalSeconds);
        var embedding = embedder.Embed(Excerpt(spans, samples)) ?? [];
        var best = embedding.Length > 0 ? store.Best(embedding) : null;
        var known = best is { Score: >= VoiceStore.MatchThreshold } ? best.Value.Name : null;
        var label = known ?? $"Speaker {++unnamed}";

        if (best is not null)
            Log.Info($"Voice {index} ({seconds:F0} s): closest stored voice {best.Value.Name} at {best.Value.Score:F2} → {label}");

        return new SpeakerInfo(index, label, known is not null, embedding, seconds);
    }

    // The voice's longest spans, up to 20 s of audio, as one stretch for the print.
    private static float[] Excerpt(List<SpeakerSpan> spans, float[] samples)
    {
        var budget = (int)(MaxPrintSeconds * MonoResampler.WhisperRate);
        var pieces = new List<float>(budget);

        foreach (var span in spans.OrderByDescending(span => span.End - span.Start))
        {
            if (pieces.Count >= budget)
                break;

            pieces.AddRange(Slice(span, samples, budget - pieces.Count));
        }

        return pieces.ToArray();
    }

    private static ArraySegment<float> Slice(SpeakerSpan span, float[] samples, int atMost)
    {
        var start = Math.Clamp((int)(span.Start.TotalSeconds * MonoResampler.WhisperRate), 0, samples.Length);
        var end = Math.Clamp((int)(span.End.TotalSeconds * MonoResampler.WhisperRate), start, samples.Length);

        return new ArraySegment<float>(samples, start, Math.Min(end - start, atMost));
    }

    private static TranscriptSegment Relabel(TranscriptSegment segment, IReadOnlyList<SpeakerSpan> spans, Dictionary<int, string> labels)
    {
        var best = spans.Select(span => (span.Index, Overlap: Overlap(segment, span))).Where(c => c.Overlap > TimeSpan.Zero).OrderByDescending(c => c.Overlap).FirstOrDefault();

        return best.Overlap > TimeSpan.Zero && labels.TryGetValue(best.Index, out var label) ? segment with { Speaker = label } : segment;
    }

    private static TimeSpan Overlap(TranscriptSegment segment, SpeakerSpan span)
    {
        var start = segment.Start > span.Start ? segment.Start : span.Start;
        var end = segment.End < span.End ? segment.End : span.End;

        return end > start ? end - start : TimeSpan.Zero;
    }
}
