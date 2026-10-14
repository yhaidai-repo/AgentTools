using PowerLoom.AudioCapture.Speakers;

namespace PowerLoom.AudioCapture.Models;

// The loaded speaker models of the resident process: the diarizer for the final pass, the embedder and the store for
// live voices and names.
public sealed record SpeakerTools(SpeakerDiarizer Diarizer, VoiceEmbedder Embedder, VoiceStore Store)
{
    public LiveSpeakers NewLiveSpeakers() => new(Embedder, Store);
}
