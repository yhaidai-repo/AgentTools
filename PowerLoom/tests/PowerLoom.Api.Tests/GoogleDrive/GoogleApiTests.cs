using System.Net;
using System.Text;
using PowerLoom.GoogleDriveIntegration.Client;
using PowerLoom.GoogleDriveIntegration.Client.Models;

namespace PowerLoom.Api.Tests.GoogleDrive;

// Google's own answers: the token endpoint in snake_case, the Drive API in camelCase (a folder was read as a file when
// mimeType went through the token's naming).
public sealed class GoogleApiTests
{
    private static readonly GoogleClient Client = new("client-1", "secret-1");

    private const string Tokens = """{"access_token":"ya29.a0Af","expires_in":3599,"scope":"https://www.googleapis.com/auth/drive.readonly","token_type":"Bearer"}""";

    [Fact]
    public async Task A_folder_is_read_as_a_folder_from_drives_camel_case_answer()
    {
        var handler = new ScriptedHandler(request => request.RequestUri!.Host == "oauth2.googleapis.com"
            ? Json(Tokens)
            : Json("""{"id":"1dWN4x3F6s5Dc2rWuWl1WnOtUQOlSMu6Z","name":"TorchIT","mimeType":"application/vnd.google-apps.folder"}"""));

        var item = await new GoogleApi(new Clients(handler)).GetItemAsync(Client, "refresh-1", "1dWN4x3F6s5Dc2rWuWl1WnOtUQOlSMu6Z", CancellationToken.None);

        Assert.Equal(new DriveItem("1dWN4x3F6s5Dc2rWuWl1WnOtUQOlSMu6Z", "TorchIT", true), item);
        Assert.Equal("Bearer ya29.a0Af", handler.Requests[1].Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task A_file_stays_a_file_and_an_unknown_id_is_none()
    {
        var file = new ScriptedHandler(request => request.RequestUri!.Host == "oauth2.googleapis.com"
            ? Json(Tokens)
            : Json("""{"id":"1FileFileFile","name":"notes.pdf","mimeType":"application/pdf"}"""));
        var missing = new ScriptedHandler(request => request.RequestUri!.Host == "oauth2.googleapis.com"
            ? Json(Tokens)
            : new HttpResponseMessage(HttpStatusCode.NotFound));

        var item = await new GoogleApi(new Clients(file)).GetItemAsync(Client, "refresh-1", "1FileFileFile", CancellationToken.None);
        var none = await new GoogleApi(new Clients(missing)).GetItemAsync(Client, "refresh-1", "1MissingMissing", CancellationToken.None);

        Assert.Equal(new DriveItem("1FileFileFile", "notes.pdf", false), item);
        Assert.Null(none);
    }

    [Fact]
    public async Task A_sign_in_reads_the_refresh_token_and_the_email_from_the_snake_case_answer()
    {
        var idToken = $"e30.{Convert.ToBase64String(Encoding.UTF8.GetBytes("""{"email":"sam@example.com"}""")).TrimEnd('=').Replace('+', '-').Replace('/', '_')}.sig";
        var handler = new ScriptedHandler(_ => Json($$"""{"access_token":"ya29.a0Af","refresh_token":"1//refresh","id_token":"{{idToken}}","token_type":"Bearer"}"""));

        var signIn = await new GoogleApi(new Clients(handler)).SignInAsync(Client, "code", "verifier", "http://127.0.0.1:3100/settings/google-drive/callback", CancellationToken.None);

        Assert.Equal(new GoogleSignIn("1//refresh", "sam@example.com"), signIn);
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class Clients(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

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
