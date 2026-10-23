using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Mcp;

namespace PowerLoom.Features.Vaults.Add;

// The vault's connection to PowerLoom's MCP server (user decision 2026-10-24: configuring a vault connects its chats
// too): the `powerloom` entry of the vault's .mcp.json, the file Claude Code reads MCP servers from. The file is
// shared with the user's other servers (e.g. azure), so only that one entry is PowerLoom's: it is added or brought up
// to date, everything else stays. A file that isn't JSON is left alone.
public sealed class McpConnectionFile(IOptions<McpOptions> options)
{
    public const string FileName = ".mcp.json";
    private const string ServerName = "powerloom";
    private const string VaultHeader = "X-PowerLoom-Vault";
    private static readonly JsonSerializerOptions Layout = new() { WriteIndented = true };

    // True when the file was written (created, or its entry changed).
    public async Task<bool> EnsureAsync(string root, string vault, CancellationToken cancellation)
    {
        if (!options.Value.IsConfigured)
            return false;

        var path = Path.Combine(root, FileName);
        var document = await ReadAsync(path, cancellation);

        if (document is null)
            return false;

        var servers = Servers(document);
        var entry = Entry(vault);

        if (servers[ServerName] is JsonNode current && JsonNode.DeepEquals(current, entry))
            return false;

        servers[ServerName] = entry;
        await File.WriteAllTextAsync(path, document.ToJsonString(Layout) + "\n", cancellation);

        return true;
    }

    private JsonObject Entry(string vault)
    {
        return new JsonObject
        {
            ["type"] = "http",
            ["url"] = options.Value.Url,
            ["headers"] = new JsonObject
            {
                ["Authorization"] = $"Bearer {options.Value.Token}",
                [VaultHeader] = vault,
            },
        };
    }

    // The file's object, a new one when the file is missing or empty; null when it holds something else than an object.
    private static async Task<JsonObject?> ReadAsync(string path, CancellationToken cancellation)
    {
        if (!File.Exists(path))
            return new JsonObject();

        var text = await File.ReadAllTextAsync(path, cancellation);

        if (string.IsNullOrWhiteSpace(text))
            return new JsonObject();

        try
        {
            return JsonNode.Parse(text) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static JsonObject Servers(JsonObject document)
    {
        if (document["mcpServers"] is JsonObject servers)
            return servers;

        var created = new JsonObject();

        document["mcpServers"] = created;

        return created;
    }
}
