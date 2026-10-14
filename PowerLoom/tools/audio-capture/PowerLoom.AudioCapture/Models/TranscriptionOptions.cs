namespace PowerLoom.AudioCapture.Models;

// Prompt = glossary and language hints. NoContext (default) stops a window's text from steering the next one: with context
// carried, large-v3 translated Russian speech into English after an English stretch (stage 1, 2026-10-14).
public sealed record TranscriptionOptions(string Prompt, bool NoContext = true, float NoSpeechThreshold = 0.6f);
