namespace PowerLoom.Contracts;

// Prepare a PBI for refinement: its note from the vault template and a refinement task (also for a PBI already in the
// pipeline: a re-refinement). `Actor` is who asked, for status_history ("human", "dispatch").
public sealed record PreparePbi(string Vault, int AdoId, string Actor) : IVaultScoped;
