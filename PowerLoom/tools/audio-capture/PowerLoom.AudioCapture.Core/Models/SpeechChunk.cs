namespace PowerLoom.AudioCapture.Models;

// A stretch of one channel between pauses, 16 kHz mono, with its position in the recording.
public sealed record SpeechChunk(string Speaker, float[] Samples, TimeSpan Start);
