using PowerLoom.Contracts;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// Mirrors the active ADO pull requests the vault's user reviews (user decision 2026-10-02): a new one gets a review the
// user starts on the Reviews page; a new push updates the mirror; one that left the list closes its review.
public sealed record SyncPullRequests(string Vault) : IVaultScoped;
