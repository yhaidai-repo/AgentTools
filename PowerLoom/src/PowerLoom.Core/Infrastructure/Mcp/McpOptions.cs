namespace PowerLoom.Infrastructure.Mcp;

// PowerLoom's MCP server for Claude chats (design powerloom-mcp, stage 1): where a chat on the PC reaches it and the
// bearer token it sends. Written into every vault's .mcp.json; both empty = no server, nothing written.
public sealed class McpOptions
{
    public const string Section = "Mcp";

    // The endpoint as the PC sees it, e.g. http://127.0.0.1:3110/mcp.
    public string Url { get; set; } = "";

    public string Token { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(Token);
}
