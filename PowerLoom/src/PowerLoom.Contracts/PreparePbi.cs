namespace PowerLoom.Contracts;

// Prepare a PBI for a pipeline stage: its note from the vault template and a task of `TaskType` (refinement by default,
// also for a PBI already in the pipeline: a re-refinement; "design" queues the planning agent). `Actor` is who asked,
// for status_history ("human", "dispatch").
public sealed record PreparePbi(string Vault, int AdoId, string Actor, string TaskType = "refinement") : IVaultScoped;
