namespace PowerLoom.Features.AiProviders.Models;

// `Provider`: the models' provider id (AgentConfig's catalog); `Source`: where the agent-runner's login comes from, null
// while not connected.
public sealed record ProviderStatus(string Provider, string Label, bool Connected, ProviderSource? Source);
