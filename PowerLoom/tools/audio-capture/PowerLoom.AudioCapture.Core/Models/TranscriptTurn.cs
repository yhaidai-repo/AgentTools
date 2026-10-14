namespace PowerLoom.AudioCapture.Models;

// Consecutive segments of one speaker: one line of the transcript, one bubble in the window.
public sealed record TranscriptTurn(string Speaker, string Channel, TimeSpan Start, TimeSpan End, string Text);
