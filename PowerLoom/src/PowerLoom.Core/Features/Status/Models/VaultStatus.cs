namespace PowerLoom.Features.Status.Models;

// One vault's integrations as the dashboard shows them: the ADO connection, when its PBIs and pull requests were last
// synced, and the import sources' last check.
public sealed record VaultStatus(string Name, bool AdoEnabled, bool AdoConfigured, DateTimeOffset? LastPbiSyncAt, DateTimeOffset? LastPullRequestSyncAt, bool ImportConfigured, string? ImportCheckedAt);
