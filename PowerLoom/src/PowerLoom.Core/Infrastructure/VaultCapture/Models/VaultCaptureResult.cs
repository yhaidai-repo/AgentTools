using System.Text.Json;

namespace PowerLoom.Infrastructure.VaultCapture.Models;

// The CLI's one JSON line: `ok` with the new record's `id`, or `errors` (invalid input, an unknown project).
public sealed record VaultCaptureResult(bool Ok, JsonElement? Id, string[]? Errors);
