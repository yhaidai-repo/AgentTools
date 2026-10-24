namespace PowerLoom.Features.AiProviders.Models;

// The agent-runner's `PUT /codex/login-file` body.
public sealed record RunnerCodexLoginFile(string AuthJson);
