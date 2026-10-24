namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;

// The run behind a recordings folder: when it ended, its PBI, and the vault it belongs to (through its PBI or task).
public sealed record RecordedRun(long Id, int? PbiId, DateTime StartedAt, DateTime? EndedAt, string Vault);
