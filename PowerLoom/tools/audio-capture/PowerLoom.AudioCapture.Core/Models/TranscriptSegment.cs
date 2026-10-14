namespace PowerLoom.AudioCapture.Models;

// One Whisper segment of one channel; Speaker is "Me" (mic) or "Them" (system audio).
public sealed record TranscriptSegment(
    string Speaker,
    TimeSpan Start,
    TimeSpan End,
    string Text,
    string Language,
    float Probability,
    float NoSpeechProbability);
