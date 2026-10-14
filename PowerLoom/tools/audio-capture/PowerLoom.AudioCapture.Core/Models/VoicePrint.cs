namespace PowerLoom.AudioCapture.Models;

// voices.json in the home: a named voice (one embedding per recording the user named it in).
public sealed record VoicePrint(string Name, float[] Embedding, DateTimeOffset AddedAt);
