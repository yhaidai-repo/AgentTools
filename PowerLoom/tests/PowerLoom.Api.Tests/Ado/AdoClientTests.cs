using System.Net;
using System.Text;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Ado;

public sealed class AdoClientTests
{
    private static readonly AdoConnection Connection = new("https://dev.azure.com/org/", "Proj", "Team A", "secret");

    [Fact]
    public async Task Work_items_are_fetched_in_batches_of_200_with_deleted_ones_omitted()
    {
        var handler = new ScriptedHandler(request => Json("""{"value":[{"id":1,"rev":3,"fields":{"System.Title":"a"}},null]}"""));
        var client = new AdoClient(new HttpClient(handler), Connection);

        var items = await client.GetWorkItemsAsync(Enumerable.Range(1, 201).ToList(), [AdoFields.Title], CancellationToken.None);

        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal("https://dev.azure.com/org/Proj/_apis/wit/workitemsbatch?api-version=7.1", handler.Requests[0].RequestUri!.ToString());
        Assert.Equal("Basic " + Convert.ToBase64String(Encoding.ASCII.GetBytes(":secret")), handler.Requests[0].Headers.Authorization!.ToString());
        Assert.Equal(2, items.Count);
        Assert.Equal("a", items[0].Fields["System.Title"].GetString());
    }

    [Fact]
    public async Task Every_field_and_link_is_asked_for_with_expand_instead_of_a_field_list()
    {
        var body = "";
        var handler = new ScriptedHandler(request =>
        {
            body = request.Content!.ReadAsStringAsync().Result;

            return Json("""{"value":[]}""");
        });
        var client = new AdoClient(new HttpClient(handler), Connection);

        await client.GetWorkItemsAsync([1], AdoFields.Every, CancellationToken.None);

        Assert.Contains("\"$expand\":\"all\"", body);
        Assert.DoesNotContain("\"fields\":", body);
    }

    [Fact]
    public async Task A_work_items_newest_comments_are_read_and_returned_oldest_first()
    {
        var handler = new ScriptedHandler(_ => Json("""{"comments":[{"text":"<p>new</p>","createdBy":{"displayName":"Ann"},"createdDate":"2026-10-02T08:00:00Z"},{"text":"<p>old</p>","createdBy":{"uniqueName":"bo@x.io"},"createdDate":"2026-10-01T08:00:00Z"}]}"""));
        var client = new AdoClient(new HttpClient(handler), Connection);

        var comments = await client.GetCommentsAsync(42, 200, CancellationToken.None);

        Assert.Equal("https://dev.azure.com/org/Proj/_apis/wit/workItems/42/comments?$top=200&order=desc&api-version=7.1-preview.4", handler.Requests[0].RequestUri!.ToString());
        Assert.Equal([("bo@x.io", "<p>old</p>"), ("Ann", "<p>new</p>")], comments.Select(comment => (comment.Author, comment.TextHtml)).ToList());
    }

    [Fact]
    public async Task A_sign_in_page_instead_of_json_is_reported_as_a_token_problem()
    {
        var handler = new ScriptedHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>sign in</html>", Encoding.UTF8, "text/html") });
        var client = new AdoClient(new HttpClient(handler), Connection);

        var error = await Assert.ThrowsAsync<AdoRequestException>(() => client.QueryIdsAsync("SELECT 1", CancellationToken.None));

        Assert.Contains("did not return JSON", error.Message);
    }

    [Fact]
    public async Task Active_pull_requests_are_read_page_by_page()
    {
        var pages = 0;
        var handler = new ScriptedHandler(_ => Json(pages++ == 0 ? FullPage() : """{"value":[]}"""));
        var client = new AdoClient(new HttpClient(handler), Connection);

        var pullRequests = await client.ListActivePullRequestsAsync(CancellationToken.None);

        Assert.Equal(100, pullRequests.Count);
        Assert.Equal(2, handler.Requests.Count);
        Assert.Contains("$skip=100", handler.Requests[1].RequestUri!.ToString());
        Assert.Equal("https://dev.azure.com/org/Proj/_git/PVS/pullrequest/1", pullRequests[0].Url);
    }

    private static string FullPage()
    {
        var items = Enumerable.Range(1, 100).Select(id => "{\"pullRequestId\":" + id + ",\"title\":\"t\",\"sourceRefName\":\"refs/heads/f\",\"targetRefName\":\"refs/heads/d\",\"repository\":{\"id\":\"r\",\"name\":\"PVS\"}}");

        return "{\"value\":[" + string.Join(",", items) + "]}";
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class ScriptedHandler(Func<HttpRequestMessage, HttpResponseMessage> answer) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);

            return Task.FromResult(answer(request));
        }
    }
}
