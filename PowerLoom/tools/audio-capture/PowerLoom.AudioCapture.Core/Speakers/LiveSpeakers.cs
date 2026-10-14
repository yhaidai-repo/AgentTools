using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Speakers;

// The voices of a running recording, told apart on the fly: every stretch of the others' channel gets a voice print;
// a print close to a stored profile takes that name, one close to a voice already heard in this meeting joins it,
// and a long enough stretch that matches nothing starts "Speaker n". Short stretches never open a voice (their prints
// are weak): they join the closest voice when it is at least somewhat close, else they stay unassigned. A voice's
// centre moves only on long stretches, so a voice can't swallow a meeting by absorbing every piece that merely leaned
// its way (2026-10-14: one stored profile took 31 of 32 segments). Now and then voices whose centres have grown close
// are merged, and naming a voice with a name another voice has merges the two.
public sealed class LiveSpeakers(VoiceEmbedder embedder, VoiceStore store)
{
    private const double MinSeconds = 1.5;
    private const double MinSecondsForNewVoice = 4;
    private const double MinSecondsToMerge = 10;
    private const int MergeEvery = 20;

    // Replays print every decision (`live-replay --trace`); the resident process keeps its log quiet.
    public static bool Trace { get; set; }

    private readonly Lock _sync = new();
    private readonly List<LiveSpeaker> _speakers = [];
    private int _assignments;

    public event Action<IReadOnlyList<SpeakerInfo>>? Changed;

    // A voice's label changed (a name given, or the voice merged into another one): old label → new label.
    public event Action<string, string>? Relabeled;

    // The voice of a stretch; `mayOpen` false (a sentence inside a chunk) only picks among the voices heard so far.
    public string? LabelFor(float[] samples, bool mayOpen = true)
    {
        var seconds = samples.Length / (double)MonoResampler.WhisperRate;

        if (seconds < MinSeconds)
            return null;

        var embedding = embedder.Embed(samples);

        if (embedding is null)
            return null;

        store.Space.Observe(embedding);

        return Assign(embedding, seconds, mayOpen && seconds >= MinSecondsForNewVoice);
    }

    public bool Rename(string oldLabel, string name)
    {
        var trimmed = name.Trim();

        if (trimmed.Length == 0 || trimmed == oldLabel)
            return false;

        var (renamed, merged, centroid) = RenameLocked(oldLabel, trimmed);

        if (!renamed)
            return false;

        if (!merged)
            store.Add(trimmed, centroid);

        Relabeled?.Invoke(oldLabel, trimmed);
        Changed?.Invoke(Snapshot());

        return true;
    }

    // A voice the user says was made by mistake: it is folded into the closest remaining voice (its speech, and the
    // stretches that would have matched it, go there). The last voice can't be removed.
    public string? Remove(string label)
    {
        var merge = RemoveLocked(label);

        if (merge is null)
            return null;

        Relabeled?.Invoke(merge.Value.Old, merge.Value.New);
        Changed?.Invoke(Snapshot());

        return merge.Value.New;
    }

    public List<SpeakerInfo> Snapshot()
    {
        lock (_sync)
        {
            return _speakers.Select(s => new SpeakerInfo(s.Index, s.Label, s.Known, s.Centroid, s.Seconds)).ToList();
        }
    }

    private string? Assign(float[] embedding, double seconds, bool mayOpen)
    {
        LiveSpeaker? speaker;
        bool created;
        List<(string Old, string New)> merges;

        lock (_sync)
        {
            speaker = Find(embedding, seconds, mayOpen);
            created = speaker is { Seconds: 0 };
            speaker?.Add(embedding, seconds, moveCentre: seconds >= MinSecondsForNewVoice);
            merges = ++_assignments % MergeEvery == 0 ? MergeCloseVoices() : [];
        }

        Announce(created, merges);

        return speaker?.Label;
    }

    private void Announce(bool created, List<(string Old, string New)> merges)
    {
        foreach (var (old, @new) in merges)
        {
            Relabeled?.Invoke(old, @new);
        }

        if (created || merges.Count > 0)
            Changed?.Invoke(Snapshot());
    }

    // A stored profile first; then the closest voice of the meeting (a long stretch needs it close, a short one only
    // somewhat close); a long stretch that matches nothing opens a voice; a short one stays unassigned.
    private LiveSpeaker? Find(float[] embedding, double seconds, bool mayOpen)
    {
        var stored = store.Best(embedding);

        if (stored is { } best && best.Score >= store.Space.StoredMatch)
            return Traced(_speakers.FirstOrDefault(s => s.Label == best.Name) ?? Create(embedding, best.Name), $"stored {best.Name} {best.Score:F2}", seconds);

        var closest = _speakers.Select(s => (Speaker: s, Score: store.Space.Similarity(s.Centroid, embedding)))
            .OrderByDescending(c => c.Score)
            .FirstOrDefault();
        var why = $"closest {closest.Speaker?.Label ?? "none"} {closest.Score:F2}, stored best {stored?.Name ?? "none"} {stored?.Score ?? 0:F2}";

        if (closest.Speaker is not null && closest.Score >= store.Space.SameInMeeting)
            return Traced(closest.Speaker, why, seconds);

        if (mayOpen)
            return Traced(Create(embedding), why + " → new", seconds);

        return Traced(closest.Speaker is not null && closest.Score >= store.Space.ShortJoin ? closest.Speaker : null, why, seconds);
    }

    private static LiveSpeaker? Traced(LiveSpeaker? speaker, string why, double seconds)
    {
        if (Trace)
            Console.WriteLine($"   voice: {seconds:F1} s → {speaker?.Label ?? "unassigned"} ({why})");

        return speaker;
    }

    private LiveSpeaker Create(float[] embedding, string? name = null)
    {
        var index = _speakers.Count == 0 ? 0 : _speakers.Max(s => s.Index) + 1;
        var unnamed = NextUnnamedNumber();
        var speaker = new LiveSpeaker(index, name ?? $"Speaker {unnamed}", name is not null, embedding);

        _speakers.Add(speaker);

        return speaker;
    }

    private int NextUnnamedNumber() =>
        _speakers.Select(s => s.Label).Where(l => l.StartsWith("Speaker ", StringComparison.Ordinal))
            .Select(l => int.TryParse(l["Speaker ".Length..], out var n) ? n : 0).DefaultIfEmpty(0).Max() + 1;

    // Pairs of established voices whose centres sit within the merge distance become one; a named voice absorbs an
    // unnamed one, the older one absorbs the younger; two differently named voices stay apart.
    private List<(string Old, string New)> MergeCloseVoices()
    {
        var merges = new List<(string, string)>();
        var pair = ClosePair();

        while (pair is not null)
        {
            merges.Add(Merge(pair.Value.Into, pair.Value.Gone));
            pair = ClosePair();
        }

        return merges;
    }

    private (LiveSpeaker Into, LiveSpeaker Gone)? ClosePair()
    {
        foreach (var a in _speakers.Where(s => s.Seconds >= MinSecondsToMerge))
        {
            foreach (var b in _speakers.Where(b => b.Index > a.Index && b.Seconds >= MinSecondsToMerge && CanMerge(a, b)))
            {
                if (store.Space.Similarity(a.Centroid, b.Centroid) >= store.Space.Merge)
                    return a.Known || !b.Known ? (a, b) : (b, a);
            }
        }

        return null;
    }

    private static bool CanMerge(LiveSpeaker a, LiveSpeaker b) => !(a.Known && b.Known && a.Label != b.Label);

    private (string Old, string New) Merge(LiveSpeaker into, LiveSpeaker gone)
    {
        into.Absorb(gone);
        _speakers.Remove(gone);

        return (gone.Label, into.Label);
    }

    private (string Old, string New)? RemoveLocked(string label)
    {
        lock (_sync)
        {
            var gone = _speakers.FirstOrDefault(s => s.Label == label);
            var closest = gone is null ? null : _speakers.Where(s => s != gone).MaxBy(s => store.Space.Similarity(s.Centroid, gone.Centroid));

            return gone is null || closest is null ? null : Merge(closest, gone);
        }
    }

    private (bool Renamed, bool Merged, float[] Centroid) RenameLocked(string oldLabel, string name)
    {
        lock (_sync)
        {
            var speaker = _speakers.FirstOrDefault(s => s.Label == oldLabel);

            if (speaker is null)
                return (false, false, []);

            var existing = _speakers.FirstOrDefault(s => s != speaker && s.Label == name);

            if (existing is not null)
            {
                Merge(existing, speaker);

                return (true, true, existing.Centroid);
            }

            speaker.Label = name;
            speaker.Known = true;

            return (true, false, speaker.Centroid);
        }
    }

    private sealed class LiveSpeaker(int index, string label, bool known, float[] first)
    {
        private int _count;

        public int Index { get; } = index;

        public string Label { get; set; } = label;

        public bool Known { get; set; } = known;

        public float[] Centroid { get; } = (float[])first.Clone();

        public double Seconds { get; private set; }

        // The centre is the mean of the long stretches' prints; short ones only count as speech time.
        public void Add(float[] embedding, double seconds, bool moveCentre)
        {
            Seconds += seconds;

            if (moveCentre)
                Blend(embedding, 1);
        }

        public void Absorb(LiveSpeaker other)
        {
            Seconds += other.Seconds;
            Blend(other.Centroid, Math.Max(1, other._count));
        }

        private void Blend(float[] embedding, int weight)
        {
            for (var i = 0; i < Centroid.Length; i++)
            {
                Centroid[i] = (Centroid[i] * _count + embedding[i] * weight) / (_count + weight);
            }

            _count += weight;
        }
    }
}
