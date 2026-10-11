namespace PowerLoom.Contracts.Confluence;

// The Confluence pages a PBI links (user decision 2026-10-02): fetched with their readable files and stored as the
// PBI's attachments for that link. Sent by Prepare (all) and the dispatcher (missing before the checks, all before a
// run); handled by the Confluence library, dropped when none is loaded.
public sealed record SyncPbiPages(string Vault, int AdoId, PageSyncScope Scope) : IVaultScoped;
