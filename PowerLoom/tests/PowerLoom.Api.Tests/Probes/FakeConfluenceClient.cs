using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.ConfluenceIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// Confluence as the tests need it: pages by link, with their files; an unknown link answers 404 like the site.
public sealed class FakeConfluenceClient : IConfluenceClient
{
    public Dictionary<string, ConfluencePage> Pages { get; } = [];

    public Dictionary<string, List<ConfluenceFile>> Files { get; } = [];

    public Dictionary<string, DownloadedFile> Downloads { get; } = [];

    public Task<ConfluencePage> PageAsync(string url, CancellationToken cancellation)
    {
        return Pages.TryGetValue(url, out var page) ? Task.FromResult(page) : throw new ConfluenceRequestException(404, "Confluence has no such page (moved, deleted, or not visible to the account)");
    }

    public Task<IReadOnlyList<ConfluenceFile>> FilesAsync(string url, CancellationToken cancellation) => Task.FromResult<IReadOnlyList<ConfluenceFile>>(Files.GetValueOrDefault(url) ?? []);

    public Task<DownloadedFile> DownloadAsync(ConfluenceFile file, CancellationToken cancellation) => Task.FromResult(Downloads[file.Id]);
}
