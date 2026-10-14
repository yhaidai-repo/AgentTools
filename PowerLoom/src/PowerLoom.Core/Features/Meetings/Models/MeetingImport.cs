namespace PowerLoom.Features.Meetings.Models;

// One meeting the audio-capture tool recorded (tools/audio-capture): the file it drops into <inbox>/meetings. `Source`
// is the tool ("audio-capture"), `SourceRef` its session folder name, so a re-sent meeting isn't imported twice.
// `Transcript` is markdown, one `[hh:mm:ss] Speaker: …` line per turn; `Speakers` the labels in it ("Me", names, "Speaker 2").
public sealed record MeetingImport(
    string Source,
    string SourceRef,
    string Title,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int DurationSec,
    string? Model,
    string? TranscriptPath,
    string Transcript,
    int SegmentCount,
    IReadOnlyList<string> Speakers);
