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
    private const double SparseMinSeconds = 6;
    private const double SparseWordsPerSecond = 0.3;

    // Whisper's favourite output for a short stretch of noise; alone in a segment it is never a real line of a meeting.
    private static readonly HashSet<string> LoneFillers = new(StringComparer.OrdinalIgnoreCase)
        { "thank you", "thanks", "thank you very much", "bye", "you", "hmm", "mm-hmm", "uh", "um" };

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

        if (!options.AcceptsLanguage(segment.Language) || IsTooSparse(segment))
            return false;

        return IsPlausibleText(segment.Text.Trim(), segment.Language);
    }

    private static bool IsPlausibleText(string text, string language)
    {
        if (text.Length == 0 || NonSpeechMarkers().IsMatch(text))
            return false;

        if (StockPhrases.Any(phrase => text.Contains(phrase, StringComparison.OrdinalIgnoreCase)))
            return false;

        if (LoneFillers.Contains(text.TrimEnd('.', '!', ',')))
            return false;

        return ScriptMatches(text, language);
    }

    // Two words stretched over half a minute ("Thank you." on 29 s of a quiet mic) is noise; speech runs 1–3 words a second.
    private static bool IsTooSparse(SegmentData segment)
    {
        var seconds = (segment.End - segment.Start).TotalSeconds;
        var words = segment.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;

        return seconds >= SparseMinSeconds && words / seconds < SparseWordsPerSecond;
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
