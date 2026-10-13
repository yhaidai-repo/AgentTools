namespace PowerLoom.LocalStackIntegration.Features.DevHub.Models;

// DevHub to test, and the agent-runner's `POST /local-stack/test` body.
public sealed record LocalStackTarget(string Url, string Token);
