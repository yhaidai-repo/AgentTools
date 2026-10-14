namespace PowerLoom.AudioCapture.Models;

// control/state.json: what the resident process is doing, for `status` and for the CLI to wait on.
public sealed record DaemonState(
    int Pid,
    DateTimeOffset StartedAt,
    string? RecordingFolder,
    string? RecordingTitle,
    DateTimeOffset? RecordingStartedAt,
    string? LastResult);
