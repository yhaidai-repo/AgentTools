namespace PowerLoom.Infrastructure.VaultCapture.Models;

// `Mode`: created, appended or rejected; `Path`: the draft relative to the docs vault (e.g. draft/pos-topic.md).
public sealed record DraftCaptureResult(bool Ok, string Mode, string? Path, IReadOnlyList<string> Errors);
