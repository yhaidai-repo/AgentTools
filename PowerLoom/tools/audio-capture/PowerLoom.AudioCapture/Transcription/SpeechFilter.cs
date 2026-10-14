using System.Text.RegularExpressions;
using Whisper.net;

namespace PowerLoom.AudioCapture.Transcription;

// Whisper invents text on silence ("*Sigh*", "[музыка]"): drop segments the model itself marks as no speech or that hold only such markers.
public static partial class SpeechFilter
{
    public static bool IsSpeech(SegmentData segment, float noSpeechThreshold)
    {
        if (segment.NoSpeechProbability > noSpeechThreshold)
            return false;

        var text = segment.Text.Trim();

        return text.Length > 0 && !NonSpeechMarkers().IsMatch(text);
    }

    // Only markers like "*Sigh*", "[Music]", "(laughs)", "♪", repeated or combined.
    [GeneratedRegex(@"^(\s*([\*\[\(][^\*\]\)]*[\*\]\)]|♪+))+\s*$")]
    private static partial Regex NonSpeechMarkers();
}
