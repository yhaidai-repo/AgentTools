using PowerLoom.Contracts;

namespace PowerLoom.Api.Tests.Probes;

// A vault-scoped message the tests own: proves the ticker publishes and the vault queues keep one vault sequential.
public sealed record VaultProbe(string Vault, string Key) : IVaultScoped;
