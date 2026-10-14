using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Speakers;

// Names a stretch of speech from the stored voices, when it is long enough to carry a voice print.
public sealed class VoiceNamer(VoiceEmbedder embedder, VoiceStore store)
{
    private const double MinSeconds = 1.5;

    public string? NameOf(float[] samples)
    {
        if (samples.Length < MinSeconds * MonoResampler.WhisperRate)
            return null;

        var embedding = embedder.Embed(samples);

        return embedding is null ? null : store.Match(embedding);
    }
}
