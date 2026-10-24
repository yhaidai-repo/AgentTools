namespace PowerLoom.Features.AiProviders.Models;

// A Codex login file (auth.json) from a PC where `codex login` worked: the fallback when the device sign-in fails.
public sealed record SaveCodexLoginFileRequest(string? AuthJson);
