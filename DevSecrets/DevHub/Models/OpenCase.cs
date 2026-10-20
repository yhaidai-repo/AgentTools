using DevSecrets.DevHub.Browser;

namespace DevSecrets.DevHub.Models;

// The open browser case: whose, where it records, its MCP process and the session DevHub reuses for its own calls.
public sealed record OpenCase(string Owner, string Case, bool Headless, string Folder, McpProcess Process, McpSession Session, DateTimeOffset StartedAt)
{
    public DateTimeOffset LastCallAt { get; set; }
}
