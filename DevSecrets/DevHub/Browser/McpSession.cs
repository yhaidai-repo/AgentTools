using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Browser;

// DevHub's own calls into the case's MCP session (the one the agent opened through the proxy): typing a secret,
// stopping the recordings, closing the browser. Streamable HTTP: one POST per JSON-RPC call; the answer comes as JSON
// or as an SSE stream whose last message carries the result.
public sealed class McpSession(HttpClient http, int port)
{
    private const string SessionHeader = "Mcp-Session-Id";
    private static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(60);

    private int _nextId = 1_000_000;

    public string? SessionId { get; set; }

    public async Task<McpToolAnswer> CallToolAsync(string name, object arguments, CancellationToken cancellationToken)
    {
        if (SessionId is null)
            return new McpToolAnswer("No MCP session: the agent has to open the browser case through the proxy first.", true);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"http://localhost:{port}/mcp");

        request.Headers.Add("Accept", "application/json, text/event-stream");
        request.Headers.Add(SessionHeader, SessionId);
        request.Content = new StringContent(JsonSerializer.Serialize(new { jsonrpc = "2.0", id = Interlocked.Increment(ref _nextId), method = "tools/call", @params = new { name, arguments } }), Encoding.UTF8, "application/json");

        using var timeout = new CancellationTokenSource(CallTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, linked.Token);
        var body = await response.Content.ReadAsStringAsync(linked.Token);

        if (!response.IsSuccessStatusCode)
            return new McpToolAnswer($"The MCP answered {(int)response.StatusCode}: {body[..Math.Min(body.Length, 300)]}", true);

        return AnswerOf(ResultMessage(body, response.Content.Headers.ContentType?.MediaType));
    }

    // SSE: the result is the last `data:` line that holds a JSON-RPC result; plain JSON: the body itself.
    private static JsonNode? ResultMessage(string body, string? mediaType)
    {
        if (mediaType != "text/event-stream")
            return JsonNode.Parse(body);

        JsonNode? last = null;

        foreach (var line in body.Split('\n'))
        {
            if (!line.StartsWith("data:", StringComparison.Ordinal))
                continue;

            var node = TryParse(line["data:".Length..].Trim());

            if (node?["result"] is not null || node?["error"] is not null)
                last = node;
        }

        return last;
    }

    private static McpToolAnswer AnswerOf(JsonNode? message)
    {
        if (message is null)
            return new McpToolAnswer("The MCP gave no result.", true);

        if (message["error"] is JsonNode error)
            return new McpToolAnswer(error["message"]?.ToString() ?? error.ToJsonString(), true);

        var result = message["result"];
        var texts = result?["content"]?.AsArray().Where(part => part?["type"]?.ToString() == "text").Select(part => part?["text"]?.ToString() ?? "") ?? [];

        return new McpToolAnswer(string.Join("\n", texts), result?["isError"]?.GetValue<bool>() == true);
    }

    private static JsonNode? TryParse(string json)
    {
        try
        {
            return JsonNode.Parse(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
