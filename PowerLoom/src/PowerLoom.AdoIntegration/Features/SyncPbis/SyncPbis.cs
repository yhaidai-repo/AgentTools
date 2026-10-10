using PowerLoom.Contracts;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Without an id: the vault's sprint, as the user's sprint Tasks define it. With one: that PBI from any sprint, in any
// state (the Backlog's "Sync PBI", user decision 2026-10-02). One vault's syncs never overlap (IVaultScoped).
public sealed record SyncPbis(string Vault, int? AdoId) : IVaultScoped;
