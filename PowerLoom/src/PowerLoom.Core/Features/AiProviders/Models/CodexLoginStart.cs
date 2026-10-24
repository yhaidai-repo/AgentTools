namespace PowerLoom.Features.AiProviders.Models;

// The link and code of Codex's device sign-in; null when the CLI's text couldn't be read, then `Output` is shown as it is.
public sealed record CodexLoginStart(string? VerificationUri, string? UserCode, string Output);
