namespace PowerLoom.AudioCapture.Models;

// One stretch of the system channel the diarizer attributes to one voice (Index per recording, 0-based).
public sealed record SpeakerSpan(TimeSpan Start, TimeSpan End, int Index);
