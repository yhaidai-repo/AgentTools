using System.Text;
using Microsoft.Extensions.Options;
using PowerLoom.Features.Vaults.Add;
using PowerLoom.Infrastructure.Mcp;

namespace PowerLoom.Api.Tests.Vaults;

public sealed class CodexConfigFileTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "powerloom-codex-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task EnsureAsync_creates_the_connection_and_writes_it_once()
    {
        var writer = Writer();

        Assert.True(await writer.EnsureAsync(root, "my-vault", CancellationToken.None));
        Assert.False(await writer.EnsureAsync(root, "my-vault", CancellationToken.None));

        var text = await File.ReadAllTextAsync(ConfigPath());

        Assert.Contains("[mcp_servers.powerloom]", text);
        Assert.Contains("url = \"http://127.0.0.1:3110/mcp\"", text);
        Assert.Contains("\"Authorization\" = \"Bearer test-token\"", text);
        Assert.Contains("\"X-PowerLoom-Vault\" = \"my-vault\"", text);
    }

    [Theory]
    [InlineData("\n")]
    [InlineData("\r\n")]
    public async Task EnsureAsync_replaces_only_the_owned_table_and_subtables(string newLine)
    {
        var prefix = "# user settings" + newLine + "[mcp_servers.azure]" + newLine + "command = 'npx'" + newLine;
        var suffix = "[mcp_servers.powerloomish]" + newLine + "command = 'keep'" + newLine;
        var owned = "[mcp_servers.powerloom]" + newLine + "url = 'old'" + newLine + "[mcp_servers.powerloom.http_headers]" + newLine + "Authorization = 'old'" + newLine;

        await WriteAsync(prefix + owned + suffix, true);
        Assert.True(await Writer().EnsureAsync(root, "vault", CancellationToken.None));

        var bytes = await File.ReadAllBytesAsync(ConfigPath());
        var text = Encoding.UTF8.GetString(bytes.AsSpan(Encoding.UTF8.Preamble.Length));

        Assert.True(bytes.AsSpan().StartsWith(Encoding.UTF8.Preamble));
        Assert.StartsWith(prefix, text);
        Assert.EndsWith(suffix, text);
        Assert.DoesNotContain("'old'", text);
        Assert.False(await Writer().EnsureAsync(root, "vault", CancellationToken.None));
    }

    [Fact]
    public async Task EnsureAsync_preserves_table_like_content_in_multiline_strings()
    {
        var original = "developer_instructions = '''\n[mcp_servers.powerloom]\nkeep this text\n'''\n";

        await WriteAsync(original, false);
        Assert.True(await Writer().EnsureAsync(root, "vault", CancellationToken.None));

        Assert.StartsWith(original, await File.ReadAllTextAsync(ConfigPath()));
    }

    [Fact]
    public async Task EnsureAsync_escapes_strings()
    {
        await Writer("token\"\\\n").EnsureAsync(root, "vault\tname", CancellationToken.None);

        var text = await File.ReadAllTextAsync(ConfigPath());

        Assert.Contains("Bearer token\\\"\\\\\\n", text);
        Assert.Contains("vault\\tname", text);
    }

    [Fact]
    public async Task EnsureAsync_does_nothing_without_configuration()
    {
        var writer = new CodexConfigFile(Options.Create(new McpOptions()));

        Assert.False(await writer.EnsureAsync(root, "vault", CancellationToken.None));
        Assert.False(Directory.Exists(root));
    }

    [Theory]
    [InlineData("[[skills.config]]\npath = 'keep'\n")]
    [InlineData("[mcp_servers.\"powerloom] # backup\"]\nurl = 'keep'\n")]
    [InlineData("[mcp_servers.\"\\U00000070owerloom.other\"]\nurl = 'keep'\n")]
    [InlineData("[mcp_servers.\"powerloom.other\"]\nurl = 'keep'\n")]
    [InlineData("[mcp_servers.'powerloom.other']\nurl = 'keep'\n")]
    public async Task EnsureAsync_preserves_array_tables_and_quoted_unrelated_server_names(string suffix)
    {
        await WriteAsync("[mcp_servers.powerloom]\nurl = 'old'\n" + suffix, false);

        Assert.True(await Writer().EnsureAsync(root, "vault", CancellationToken.None));
        Assert.EndsWith(suffix, await File.ReadAllTextAsync(ConfigPath()));
        Assert.False(await Writer().EnsureAsync(root, "vault", CancellationToken.None));
    }

    public void Dispose()
    {
        if (Directory.Exists(root))
            Directory.Delete(root, true);
    }

    private static CodexConfigFile Writer(string token = "test-token")
    {
        return new CodexConfigFile(Options.Create(new McpOptions { Url = "http://127.0.0.1:3110/mcp", Token = token }));
    }

    private string ConfigPath()
    {
        return Path.Combine(root, ".codex", "config.toml");
    }

    private async Task WriteAsync(string text, bool bom)
    {
        Directory.CreateDirectory(Path.Combine(root, ".codex"));
        await File.WriteAllTextAsync(ConfigPath(), text, new UTF8Encoding(bom));
    }
}
