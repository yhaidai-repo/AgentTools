namespace PowerLoom.Infrastructure.VaultCapture.Models;

// `Mode`: created, appended or rejected; `Path`: the draft relative to the docs vault (e.g. draft/pvs-topic.md).
public sealed record DraftCaptureResult(bool Ok, string Mode, string? Path, IReadOnlyList<string> Errors);
