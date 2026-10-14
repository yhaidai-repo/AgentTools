namespace PowerLoom.AudioCapture.Models;

// import-inbox/meetings/<sourceRef>.json: what PowerLoom's `meetings` source reads (stage 3 parses the same shape).
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
    int SegmentCount);
