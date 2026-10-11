namespace PowerLoom.Contracts.Documents;

// Every document the PBI links ends up readable for the agents or as a human task asking for it (user decision
// 2026-10-01): ADO attachments are downloaded with the vault's token (the ADO library), web pages become tasks; the
// Confluence pages are SyncPbiPages' (the Confluence library). Before an agent starts on the PBI and after Prepare.
public sealed record CollectLinkedDocuments(string Vault, int AdoId) : IVaultScoped;
