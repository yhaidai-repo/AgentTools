using Microsoft.Extensions.Primitives;

namespace DevSecrets.DevHub.Browser;

// Forwards the agent's MCP traffic (`/browser/mcp`, behind DevHub's token) to the case's Playwright MCP on localhost,
// streaming the answer back as it arrives (SSE). The MCP accepts only localhost as its host, so DevHub is the way in
// from Docker. The session id the MCP hands out is kept for DevHub's own calls.
public static class McpProxy
{
    private const string SessionHeader = "Mcp-Session-Id";
    private static readonly string[] ForwardedRequestHeaders = ["Accept", SessionHeader, "Mcp-Protocol-Version", "Last-Event-ID"];
    private static readonly string[] ForwardedResponseHeaders = [SessionHeader, "Mcp-Protocol-Version"];

    public static async Task ForwardAsync(HttpContext context, HttpClient http, int port, Action<string> onSession)
    {
        using var request = BuildRequest(context, port);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);

        context.Response.StatusCode = (int)response.StatusCode;
        CopyResponseHeaders(response, context.Response, onSession);

        await using var body = await response.Content.ReadAsStreamAsync(context.RequestAborted);

        await body.CopyToAsync(context.Response.Body, context.RequestAborted);
    }

    private static HttpRequestMessage BuildRequest(HttpContext context, int port)
    {
        var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), $"http://localhost:{port}/mcp{context.Request.QueryString}");

        foreach (var name in ForwardedRequestHeaders)
            CopyRequestHeader(context.Request.Headers, name, request);

        if (context.Request.ContentLength > 0 || context.Request.Headers.TransferEncoding.Count > 0)
        {
            request.Content = new StreamContent(context.Request.Body);
            request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(context.Request.ContentType ?? "application/json");
        }

        return request;
    }

    private static void CopyRequestHeader(IHeaderDictionary headers, string name, HttpRequestMessage request)
    {
        if (headers.TryGetValue(name, out StringValues values))
            request.Headers.TryAddWithoutValidation(name, values.ToArray());
    }

    private static void CopyResponseHeaders(HttpResponseMessage response, HttpResponse target, Action<string> onSession)
    {
        if (response.Content.Headers.ContentType is not null)
            target.ContentType = response.Content.Headers.ContentType.ToString();

        foreach (var name in ForwardedResponseHeaders)
        {
            if (!response.Headers.TryGetValues(name, out var values))
                continue;

            var value = string.Join(",", values);

            target.Headers[name] = value;

            if (name == SessionHeader)
                onSession(value);
        }
    }
}
