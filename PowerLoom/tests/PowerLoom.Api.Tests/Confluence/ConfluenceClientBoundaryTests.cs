using System.Net;
using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.ConfluenceIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Confluence;

public sealed class ConfluenceClientBoundaryTests
{
    private const string Site = "https://trusted.example.invalid";
    private const string Page = Site + "/wiki/spaces/D/pages/123/demo";
    private static ConfluenceFile FileOf(string url) => new("1", "demo.txt", "text/plain", 4, url);

    [Theory]
    [InlineData("https://foreign.example.invalid/wiki/pages/123")]
    [InlineData("http://trusted.example.invalid/wiki/pages/123")]
    public async Task All_entry_paths_reject_untrusted_targets_before_requests(string target)
    {
        using var handler = new FakeHandler(_ => Json("{}"));
        using var http = new HttpClient(handler);
        var client = new ConfluenceClient(http, "synthetic", "synthetic", Site);
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.PageAsync(target, CancellationToken.None));
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.FilesAsync(target, CancellationToken.None));
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.DownloadAsync(FileOf(target), CancellationToken.None));
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task Attachment_links_are_deserialized_and_all_pages_are_read()
    {
        using var handler = new FakeHandler(call => Json(call == 1
            ? """{"results":[{"id":"1","title":"one","mediaType":"text/plain","fileSize":4,"downloadLink":"/download/attachments/123/one"}],"_links":{"next":"/wiki/next"}}"""
            : """{"results":[{"id":"2","title":"two","mediaType":"text/plain","fileSize":4,"downloadLink":"/download/attachments/123/two"}]}"""));
        using var http = new HttpClient(handler);
        var files = await new ConfluenceClient(http, "synthetic", "synthetic", Site).FilesAsync(Page, CancellationToken.None);
        Assert.Equal(2, files.Count);
        Assert.Equal(Site + "/wiki/download/attachments/123/one", files[0].DownloadUrl);
        Assert.Equal(2, handler.Calls);
    }

    [Fact]
    public async Task Redirects_and_continuation_targets_are_validated_before_forwarding_credentials()
    {
        using var handler = new FakeHandler(_ => Redirect("https://foreign.example.invalid/capture"));
        using var http = new HttpClient(handler);
        var client = new ConfluenceClient(http, "synthetic", "synthetic", Site);
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.PageAsync(Page, CancellationToken.None));
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.DownloadAsync(FileOf(Site + "/wiki/file"), CancellationToken.None));
        Assert.Equal(2, handler.Calls);
        handler.Answer = _ => Json("""{"results":[],"_links":{"next":"https://foreign.example.invalid/capture"}}""");
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.FilesAsync(Page, CancellationToken.None));
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task Trusted_redirects_work_and_later_page_failures_do_not_return_partial_results()
    {
        using var handler = new FakeHandler(call => call == 1 ? Redirect("/wiki/final") : Json("""{"id":"123","title":"Demo","version":{"number":1}}"""));
        using var http = new HttpClient(handler);
        var client = new ConfluenceClient(http, "synthetic", "synthetic", Site);
        Assert.Equal("Demo", (await client.PageAsync(Page, CancellationToken.None)).Title);
        handler.Answer = call => call == 3 ? Json("""{"results":[],"_links":{"next":"/wiki/next"}}""") : new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
        await Assert.ThrowsAsync<ConfluenceRequestException>(() => client.FilesAsync(Page, CancellationToken.None));
        Assert.Equal(4, handler.Calls);
    }

    private static HttpResponseMessage Json(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value, System.Text.Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Redirect(string location) => new(HttpStatusCode.Found) { Headers = { Location = new Uri(location, UriKind.RelativeOrAbsolute) } };
    private sealed class FakeHandler(Func<int, HttpResponseMessage> answer) : HttpMessageHandler
    {
        public Func<int, HttpResponseMessage> Answer { get; set; } = answer;
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal(Site, request.RequestUri!.GetLeftPart(UriPartial.Authority));
            Assert.Equal("Basic", request.Headers.Authorization?.Scheme);
            return Task.FromResult(Answer(++Calls));
        }
    }
}
