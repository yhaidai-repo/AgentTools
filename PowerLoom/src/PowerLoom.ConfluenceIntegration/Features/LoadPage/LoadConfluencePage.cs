using PowerLoom.Contracts;

namespace PowerLoom.ConfluenceIntegration.Features.LoadPage;

// The user's "Load from Confluence" for one linked page: fetched (or brought to its current version) now.
public sealed record LoadConfluencePage(string Vault, int AdoId, string Url) : IVaultScoped;
