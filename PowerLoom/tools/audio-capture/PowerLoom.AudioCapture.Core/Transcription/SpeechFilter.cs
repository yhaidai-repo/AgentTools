using System.Text.RegularExpressions;
using PowerLoom.AudioCapture.Models;
using Whisper.net;

namespace PowerLoom.AudioCapture.Transcription;

// Whisper invents text on silence and noise: stock phrases ("Дякую за перегляд!", "Thanks for watching"), markers
// ("*Sigh*", "[музыка]"), a word in a random language. Drops segments the model marks as no speech, too short ones,
// marker-only ones, known stock phrases, a language the settings don't expect, and text whose script contradicts the
// detected language (Cyrillic tagged English).
public static partial class SpeechFilter
{
    private static readonly string[] StockPhrases =
    [
        "дякую за перегляд", "дякую за увагу", "підписуйтесь", "спасибо за просмотр", "спасибо за внимание", "подписывайтесь",
        "продолжение следует", "субтитры", "thanks for watching", "thank you for watching", "subscribe", "see you in the next",
    ];

    public static bool IsSpeech(SegmentData segment, TranscriptionOptions options)
    {
        if (segment.NoSpeechProbability > options.NoSpeechThreshold)
            return false;

        if ((segment.End - segment.Start).TotalSeconds < options.MinSegmentSeconds)
            return false;

        if (!options.AcceptsLanguage(segment.Language))
            return false;

        return IsPlausibleText(segment.Text.Trim(), segment.Language);
    }

    private static bool IsPlausibleText(string text, string language)
    {
        if (text.Length == 0 || NonSpeechMarkers().IsMatch(text))
            return false;

        if (StockPhrases.Any(phrase => text.Contains(phrase, StringComparison.OrdinalIgnoreCase)))
            return false;

        return ScriptMatches(text, language);
    }

    // English with Cyrillic letters is a hallucination; Ukrainian or Russian written in Latin letters is a term or a name.
    private static bool ScriptMatches(string text, string language) =>
        language != "en" || !Cyrillic().IsMatch(text);

    // Only markers like "*Sigh*", "[Music]", "(laughs)", "♪", repeated or combined.
    [GeneratedRegex(@"^(\s*([\*\[\(][^\*\]\)]*[\*\]\)]|♪+))+\s*$")]
    private static partial Regex NonSpeechMarkers();

    [GeneratedRegex(@"\p{IsCyrillic}")]
    private static partial Regex Cyrillic();
}
