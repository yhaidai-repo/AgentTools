using PowerLoom.Contracts;

namespace PowerLoom.Features.Cleanup;

// The daily artefact cleanup of one vault (user decision 2026-10-21): each store's items past their buffer go, or are
// only reported while the cleanup settings say dry run.
public sealed record CleanUpArtefacts(string Vault) : IVaultScoped;
