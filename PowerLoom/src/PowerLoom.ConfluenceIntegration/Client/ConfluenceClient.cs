using System.Net.Http.Headers;
using System.Text;
using System.Net.Http.Json;
using System.Text.Json;
using PowerLoom.ConfluenceIntegration.Client.Models;
using PowerLoom.Domain.Pbis;

namespace PowerLoom.ConfluenceIntegration.Client;

// Read-only Confluence Cloud REST client (API v2) for the pages a link points to.
public sealed class ConfluenceClient(HttpClient http, string email, string apiToken) : IConfluenceClient
{
    private const int FilesPageSize = 100;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // The answers Confluence gives for the usual problems, in words the user can act on.
    private static readonly Dictionary<int, string> StatusReasons = new()
    {
        [401] = "Confluence rejected the credentials (Confluence:Email / Confluence:ApiToken; an API token can expire)",
        [403] = "the Confluence account has no access to this page",
        [404] = "Confluence has no such page (moved, deleted, or not visible to the account)",
    };

    private readonly AuthenticationHeaderValue _authorization = new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{email}:{apiToken}")));

    public async Task<ConfluencePage> PageAsync(string url, CancellationToken cancellation)
    {
        var id = RequirePageId(url);
        var page = await GetJsonAsync<PageDto>($"{ConfluencePageLinks.Site(url)}/wiki/api/v2/pages/{id}?body-format=view", cancellation);

        return new ConfluencePage(page.Id, page.Title, page.Version.Number, page.Body?.View?.Value ?? "");
    }

    public async Task<IReadOnlyList<ConfluenceFile>> FilesAsync(string url, CancellationToken cancellation)
    {
        var site = ConfluencePageLinks.Site(url);
        var files = new List<ConfluenceFile>();
        var next = $"/wiki/api/v2/pages/{RequirePageId(url)}/attachments?limit={FilesPageSize}";

        while (next is not null)
        {
            var batch = await GetJsonAsync<FilesDto>($"{site}{next}", cancellation);

            files.AddRange(batch.Results.Select(file => new ConfluenceFile(file.Id, file.Title, file.MediaType, file.FileSize, $"{site}/wiki{file.DownloadLink}")));
            next = batch.Links?.Next;
        }

        return files;
    }

    public async Task<DownloadedFile> DownloadAsync(ConfluenceFile file, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, file.DownloadUrl) { Headers = { Authorization = _authorization } };
        using var response = await http.SendAsync(request, cancellation);

        if (!response.IsSuccessStatusCode)
            throw Failure((int)response.StatusCode, $"download of {file.FileName}");

        return new DownloadedFile(file.FileName, response.Content.Headers.ContentType?.ToString() ?? file.MediaType, await response.Content.ReadAsByteArrayAsync(cancellation));
    }

    private async Task<T> GetJsonAsync<T>(string url, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url) { Headers = { Authorization = _authorization, Accept = { new MediaTypeWithQualityHeaderValue("application/json") } } };
        using var response = await http.SendAsync(request, cancellation);

        if (!response.IsSuccessStatusCode)
            throw Failure((int)response.StatusCode, url);

        return await response.Content.ReadFromJsonAsync<T>(Json, cancellation) ?? throw new ConfluenceRequestException(502, $"Confluence answered nothing for {url}");
    }

    private static string RequirePageId(string url)
    {
        return ConfluencePageLinks.PageId(url) ?? throw new ConfluenceRequestException(400, "the link isn't a /pages/<id> link (short /wiki/x/ links can't be read; use the page's full link)");
    }

    private static ConfluenceRequestException Failure(int status, string what) => new(status, StatusReasons.GetValueOrDefault(status) ?? $"Confluence answered {status} for {what}");

    private sealed record PageDto(string Id, string Title, VersionDto Version, BodyDto? Body);

    private sealed record VersionDto(int Number);

    private sealed record BodyDto(ViewDto? View);

    private sealed record ViewDto(string? Value);

    private sealed record FileDto(string Id, string Title, string MediaType, long FileSize, string DownloadLink);

    private sealed record FilesDto(List<FileDto> Results, LinksDto? Links);

    private sealed record LinksDto(string? Next);
}
