using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Speakers;

// The voices of a running recording, told apart on the fly: every chunk of the others' channel gets a voice print; a
// print close to a stored profile takes that name, one close to a voice already heard in this meeting joins it, any
// other starts "Speaker n". Naming a voice mid-meeting stores its profile. Called from the live worker and the window.
public sealed class LiveSpeakers(VoiceEmbedder embedder, VoiceStore store)
{
    private const double MinSeconds = 1.5;

    private readonly Lock _sync = new();
    private readonly List<LiveSpeaker> _speakers = [];

    public event Action<IReadOnlyList<SpeakerInfo>>? Changed;

    public string? LabelFor(float[] samples)
    {
        if (samples.Length < MinSeconds * MonoResampler.WhisperRate)
            return null;

        var embedding = embedder.Embed(samples);

        if (embedding is null)
            return null;

        store.Space.Observe(embedding);

        return Assign(embedding, samples.Length / (double)MonoResampler.WhisperRate);
    }

    public bool Rename(string oldLabel, string name)
    {
        var trimmed = name.Trim();

        if (trimmed.Length == 0 || trimmed == oldLabel || !RelabelLocked(oldLabel, trimmed, out var centroid))
            return false;

        store.Add(trimmed, centroid);
        Changed?.Invoke(Snapshot());

        return true;
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

        lock (_sync)
        {
            speaker = Find(embedding) ?? Create(embedding);
            created = speaker.Seconds == 0;
            speaker.Add(embedding, seconds);
        }

        if (created)
            Changed?.Invoke(Snapshot());

        return speaker.Label;
    }

    private LiveSpeaker? Find(float[] embedding)
    {
        if (store.Match(embedding) is { } name)
            return _speakers.FirstOrDefault(s => s.Label == name) ?? Create(embedding, name);

        return _speakers.Select(s => (Speaker: s, Score: store.Space.Similarity(s.Centroid, embedding)))
            .Where(c => c.Score >= store.Space.SameInMeeting)
            .OrderByDescending(c => c.Score)
            .Select(c => c.Speaker)
            .FirstOrDefault();
    }

    private LiveSpeaker Create(float[] embedding, string? name = null)
    {
        var index = _speakers.Count;
        var unnamed = _speakers.Count(s => !s.Known) + 1;
        var speaker = new LiveSpeaker(index, name ?? $"Speaker {unnamed}", name is not null, embedding);

        _speakers.Add(speaker);

        return speaker;
    }

    private bool RelabelLocked(string oldLabel, string name, out float[] centroid)
    {
        lock (_sync)
        {
            var speaker = _speakers.FirstOrDefault(s => s.Label == oldLabel);

            centroid = speaker?.Centroid ?? [];

            if (speaker is null)
                return false;

            speaker.Label = name;
            speaker.Known = true;

            return true;
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
        public void Add(float[] embedding, double seconds)
        {
            for (var i = 0; i < Centroid.Length; i++)
            {
                Centroid[i] = (Centroid[i] * _count + embedding[i]) / (_count + 1);
            }

            _count++;
            Seconds += seconds;
        }
    }
}
