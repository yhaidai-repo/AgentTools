namespace PowerLoom.Features.AiProviders.Models;

// The agent-runner's start-up report (`claudeEnvToken`): whether .env gave it a token, never the token.
public sealed class EnvTokenReport
{
    public bool Present { get; set; }
}
