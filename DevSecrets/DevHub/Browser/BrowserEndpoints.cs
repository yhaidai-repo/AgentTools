using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Browser;

public static class BrowserEndpoints
{
    private const string BrowserPath = "/browser";

    public static WebApplication MapBrowserEndpoints(this WebApplication app)
    {
        app.MapPost(BrowserPath, OpenAsync);
        app.MapGet(BrowserPath, (BrowserService browsers, CancellationToken cancellationToken) => browsers.GetStatusAsync(cancellationToken));
        app.Map($"{BrowserPath}/mcp", (HttpContext context, BrowserService browsers) => browsers.ProxyAsync(context));
        app.MapPost($"{BrowserPath}/type-secret", TypeSecretAsync);
        app.MapDelete(BrowserPath, CloseAsync);
        app.MapGet($"{BrowserPath}/artifacts", (string owner, BrowserService browsers) => TypedResults.Ok(new { owner, artifacts = browsers.ListArtifacts(owner) }));

        return app;
    }

    private static async Task<IResult> OpenAsync(OpenBrowserRequest request, BrowserService browsers, CancellationToken cancellationToken) =>
        ToResult(await browsers.OpenAsync(request, cancellationToken));

    private static async Task<IResult> TypeSecretAsync(TypeSecretRequest request, BrowserService browsers, CancellationToken cancellationToken) =>
        ToResult(await browsers.TypeSecretAsync(request, cancellationToken));

    // Not the request's token: a client that gives up must not leave a half-closed recording.
    private static async Task<IResult> CloseAsync(BrowserService browsers, string? owner = null) =>
        ToResult(await browsers.CloseAsync(owner, CancellationToken.None));

    private static IResult ToResult<T>(HubResult<T> result)
    {
        if (!result.IsSuccess)
            return TypedResults.Problem(result.Error, statusCode: result.StatusCode);

        return TypedResults.Ok(result.Value);
    }
}
