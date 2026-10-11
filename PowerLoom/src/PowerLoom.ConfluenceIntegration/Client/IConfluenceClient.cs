using PowerLoom.ConfluenceIntegration.Client.Models;

namespace PowerLoom.ConfluenceIntegration.Client;

// Read-only Confluence Cloud access for the pages a link points to. Never add write calls.
public interface IConfluenceClient
{
    Task<ConfluencePage> PageAsync(string url, CancellationToken cancellation);

    // Every file attached to the page.
    Task<IReadOnlyList<ConfluenceFile>> FilesAsync(string url, CancellationToken cancellation);

    Task<DownloadedFile> DownloadAsync(ConfluenceFile file, CancellationToken cancellation);
}
