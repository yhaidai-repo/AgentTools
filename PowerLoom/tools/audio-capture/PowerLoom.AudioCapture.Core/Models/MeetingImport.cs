namespace PowerLoom.AudioCapture.Models;

// import-inbox/meetings/<sourceRef>.json: what PowerLoom's `meetings` source reads (stage 3 parses the same shape).
// Speakers: the labels in the transcript ("Me", names the user gave, "Speaker 2" for voices nobody named yet).
public sealed record MeetingImport(
    string Source,
    string SourceRef,
    string Title,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int DurationSec,
    string Model,
    string TranscriptPath,
    string Transcript,
    int SegmentCount,
    IReadOnlyList<string> Speakers);
