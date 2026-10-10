namespace PowerLoom.Infrastructure.VaultCapture.Models;

// The CLI's JSON line for `capture`.
public sealed record CaptureOutput(bool Ok, string? Mode, string? Path, string[]? Errors);
