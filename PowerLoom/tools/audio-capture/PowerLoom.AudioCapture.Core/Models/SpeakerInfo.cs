namespace PowerLoom.AudioCapture.Models;

// speakers.json of a session: one voice the diarizer found, its label ("Speaker 2" or a name), whether the name came from
// a stored voice print, and the voice print of this recording (so a rename can store it).
public sealed record SpeakerInfo(int Index, string Label, bool Known, float[] Embedding, double Seconds);
