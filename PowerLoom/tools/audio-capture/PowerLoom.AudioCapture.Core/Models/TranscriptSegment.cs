namespace PowerLoom.AudioCapture.Models;

// One Whisper segment. Channel is "Me" (mic) or "Them" (system audio); Speaker is the label shown: the channel name, or
// after diarization "Speaker 2" or a name the user gave ("Anna"). Older files have no Channel: the Speaker was it.
public sealed record TranscriptSegment(
    string Speaker,
    TimeSpan Start,
    TimeSpan End,
    string Text,
    string Language,
    float Probability,
    float NoSpeechProbability,
    string Channel = "")
{
    public string ChannelOrSpeaker => Channel.Length > 0 ? Channel : Speaker;
}
