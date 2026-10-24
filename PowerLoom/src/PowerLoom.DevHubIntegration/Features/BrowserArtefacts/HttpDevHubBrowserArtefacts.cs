using System.Net.Http.Headers;
using System.Net.Http.Json;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts;

// Calls DevHub on the Windows host directly (host.docker.internal, like the agent-runner does) with the vault's token.
public sealed class HttpDevHubBrowserArtefacts(IHttpClientFactory clients, ILogger<HttpDevHubBrowserArtefacts> logger) : IDevHubBrowserArtefacts
{
    public const string HttpClientName = "devhub";
    private static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(30);

    public Task<IReadOnlyList<OwnerArtefacts>?> ListOwnersAsync(DevHubTarget target, CancellationToken cancellation) =>
        SendAsync<IReadOnlyList<OwnerArtefacts>>(target, HttpMethod.Get, "/browser/artifacts/owners", cancellation);

    public Task<DeletedArtefacts?> DeleteOwnerAsync(DevHubTarget target, string owner, bool dryRun, CancellationToken cancellation) =>
        SendAsync<DeletedArtefacts>(target, HttpMethod.Delete, $"/browser/artifacts/{Uri.EscapeDataString(owner)}?dryRun={(dryRun ? "true" : "false")}", cancellation);

    private async Task<T?> SendAsync<T>(DevHubTarget target, HttpMethod method, string path, CancellationToken cancellation)
        where T : class
    {
        try
        {
            return await SendOrThrowAsync<T>(target, method, path, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning("DevHub {Method} {Path} didn't answer: {Error}", method, path, error.Message);

            return null;
        }
    }

    private async Task<T?> SendOrThrowAsync<T>(DevHubTarget target, HttpMethod method, string path, CancellationToken cancellation)
        where T : class
    {
        using var http = clients.CreateClient(HttpClientName);
        http.Timeout = CallTimeout;

        using var request = new HttpRequestMessage(method, $"{target.Url.TrimEnd('/')}{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", target.Token);

        using var response = await http.SendAsync(request, cancellation);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<T>(cancellation);
    }
}
