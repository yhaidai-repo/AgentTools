namespace PowerLoom.DevHubIntegration.Features.DevHub.Models;

// DevHub to test, and the agent-runner's `POST /devhub/test` body.
public sealed record DevHubTarget(string Url, string Token);
