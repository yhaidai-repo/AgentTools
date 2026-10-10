using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis.Models;

// The PBI an item is filed under.
public sealed record ParentPbi(int AdoId, string Title, string Vault, PipelineStatus PipelineStatus);
