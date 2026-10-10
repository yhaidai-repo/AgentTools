namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// `Sources` (sprint, imports) applies without an id; omitted = the sprint.
public sealed record SyncPbisRequest(string Vault, int? AdoId, SyncSources? Sources);
