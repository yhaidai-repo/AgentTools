namespace PowerLoom.AudioCapture.Models;

// Prompt = glossary and language hints. NoContext (default) stops a window's text from steering the next one: with context
// carried, large-v3 translated Russian speech into English after an English stretch (stage 1, 2026-10-14).
// Languages = the ones expected in meetings (ISO codes); a segment detected as another one is noise. Empty = any.
public sealed record TranscriptionOptions(
    string Prompt,
    bool NoContext = true,
    float NoSpeechThreshold = 0.6f,
    double MinSegmentSeconds = 0.5,
    IReadOnlySet<string>? Languages = null)
{
    public static IReadOnlySet<string> ParseLanguages(string list) =>
        list.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(code => code.ToLowerInvariant())
            .ToHashSet();

    public bool AcceptsLanguage(string language) =>
        Languages is null || Languages.Count == 0 || Languages.Contains(language.ToLowerInvariant());
}
