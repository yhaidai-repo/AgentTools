using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Speakers;

// The voices of a running recording, told apart on the fly: every stretch of the others' channel gets a voice print;
// a print close to a stored profile takes that name, one close to a voice already heard in this meeting joins it,
// and a long enough stretch that matches nothing starts "Speaker n". Short stretches never open a voice (their prints
// are weak; 35 voices in one meeting on 2026-10-14): they join the closest one. Now and then voices whose prints have
// grown close are merged, and naming a voice with a name another voice has merges the two.
public sealed class LiveSpeakers(VoiceEmbedder embedder, VoiceStore store)
{
    private const double MinSeconds = 1.5;
    private const double MinSecondsForNewVoice = 4;
    private const int MergeEvery = 20;

    private readonly Lock _sync = new();
    private readonly List<LiveSpeaker> _speakers = [];
    private int _assignments;

    public event Action<IReadOnlyList<SpeakerInfo>>? Changed;

    // A voice's label changed (a name given, or the voice merged into another one): old label → new label.
    public event Action<string, string>? Relabeled;

    public string? LabelFor(float[] samples)
    {
        var seconds = samples.Length / (double)MonoResampler.WhisperRate;

        if (seconds < MinSeconds)
            return null;

        var embedding = embedder.Embed(samples);

        if (embedding is null)
            return null;

        store.Space.Observe(embedding);

        return Assign(embedding, seconds);
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

    private string Assign(float[] embedding, double seconds)
    {
        LiveSpeaker speaker;
        bool created;
        List<(string Old, string New)> merges;

        lock (_sync)
        {
            speaker = Find(embedding, seconds) ?? Create(embedding);
            created = speaker.Seconds == 0;
            speaker.Add(embedding, seconds);
            merges = ++_assignments % MergeEvery == 0 ? MergeCloseVoices() : [];
        }

        Announce(created, merges);

        return speaker.Label;
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

    private LiveSpeaker? Find(float[] embedding, double seconds)
    {
        if (store.Match(embedding) is { } name)
            return _speakers.FirstOrDefault(s => s.Label == name) ?? Create(embedding, name);

        var closest = _speakers.Select(s => (Speaker: s, Score: store.Space.Similarity(s.Centroid, embedding)))
            .OrderByDescending(c => c.Score)
            .FirstOrDefault();

        if (closest.Speaker is null)
            return null;

        return closest.Score >= store.Space.SameInMeeting || seconds < MinSecondsForNewVoice ? closest.Speaker : null;
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

    // Pairs whose centroids sit within the same-voice distance become one; a named voice absorbs an unnamed one, the
    // older one absorbs the younger; two differently named voices stay apart.
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
        foreach (var a in _speakers)
        {
            foreach (var b in _speakers.Where(b => b.Index > a.Index && CanMerge(a, b)))
            {
                if (store.Space.Similarity(a.Centroid, b.Centroid) >= store.Space.SameInMeeting)
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

        // Running mean of the prints: the voice's centre settles as the meeting goes on.
        public void Add(float[] embedding, double seconds) => Blend(embedding, 1, seconds);

        public void Absorb(LiveSpeaker other) => Blend(other.Centroid, Math.Max(1, other._count), other.Seconds);

        private void Blend(float[] embedding, int weight, double seconds)
        {
            for (var i = 0; i < Centroid.Length; i++)
            {
                Centroid[i] = (Centroid[i] * _count + embedding[i] * weight) / (_count + weight);
            }

            _count += weight;
            Seconds += seconds;
        }
    }
}
