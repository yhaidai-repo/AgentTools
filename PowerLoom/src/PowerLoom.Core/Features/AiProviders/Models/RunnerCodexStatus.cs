namespace PowerLoom.Features.AiProviders.Models;

// The agent-runner's `GET /codex/status`: whether PowerLoom's Codex home holds a login.
public sealed record RunnerCodexStatus(bool Connected);
