namespace PowerLoom.Contracts.Documents;

// Every document the PBI links ends up readable for the agents or as a human task asking for it (user decision
// 2026-10-01): ADO attachments are downloaded with the vault's token (the ADO library); the Confluence pages are
// SyncPbiPages' (the Confluence library). Before an agent starts on the PBI and after Prepare. A web page becomes a task
// only with `AskForWebPages`, for an agent without web access: one with it reads the page itself (user decision
// 2026-10-14).
public sealed record CollectLinkedDocuments(string Vault, int AdoId, bool AskForWebPages = false) : IVaultScoped;
