namespace PowerLoom.Contracts;

// A PBI's data changed (status, tasks, answers, uploads): its notes are rendered again. The only event Pbis listens to
// (user decision 2026-10-10: no Pipeline slice).
public sealed record PbiChanged(string Vault, int AdoId) : IVaultScoped;
