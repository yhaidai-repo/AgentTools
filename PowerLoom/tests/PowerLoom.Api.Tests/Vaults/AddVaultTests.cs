using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Vaults.Add;
using PowerLoom.Features.Vaults.Add.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Vaults;

[Collection(PowerLoomCollection.Name)]
public sealed class AddVaultTests(PowerLoomHost host)
{
    [Fact]
    public async Task A_new_folder_becomes_a_vault_with_the_template_files()
    {
        var added = await host.Host.PostJson(new AddVaultRequest($"{PowerLoomHost.HostRoot}/notes-vault"), "/api/vaults").Receive<AddedVault>();
        var root = Path.Combine(host.VaultsRoot, "notes-vault");
        var agents = await File.ReadAllTextAsync(Path.Combine(root, "AGENTS.md"));

        Assert.Equal("notes-vault", added!.Vault);
        Assert.Equal(["draft/", ".usage/", ".obsidian/"], added.Created.Take(3));
        Assert.Equal([".mcp.json", "AGENTS.md", "POWERLOOM.md"], added.Created.Skip(3).Order(StringComparer.Ordinal));
        Assert.Contains($"vault at {PowerLoomHost.HostRoot}/notes-vault", agents);
        Assert.DoesNotContain("{{", agents);
        Assert.Contains("\"X-PowerLoom-Vault\": \"notes-vault\"", await File.ReadAllTextAsync(Path.Combine(root, ".mcp.json")));
        Assert.True(await IsActiveVaultAsync("notes-vault"));
    }

    // The vault's .mcp.json is shared with the user's other servers: PowerLoom owns its entry only (user decision 2026-10-24).
    [Fact]
    public async Task The_MCP_entry_joins_the_user_s_servers_and_is_written_once()
    {
        var initializer = host.Host.Services.GetRequiredService<VaultInitializer>();
        var path = Path.Combine(host.VaultRoot, ".mcp.json");

        await File.WriteAllTextAsync(path, """{ "mcpServers": { "azure": { "command": "npx" }, "powerloom": { "type": "http", "url": "http://old" } } }""");

        var changed = await initializer.RefreshOwnedFilesAsync(PowerLoomHost.Vault, CancellationToken.None);
        var changedAgain = await initializer.RefreshOwnedFilesAsync(PowerLoomHost.Vault, CancellationToken.None);
        var written = await File.ReadAllTextAsync(path);

        Assert.True(changed);
        Assert.False(changedAgain);
        Assert.Contains("\"azure\"", written);
        Assert.Contains("\"url\": \"http://127.0.0.1:3110/mcp\"", written);
        Assert.Contains("\"Authorization\": \"Bearer test-token\"", written);
        Assert.Contains($"\"X-PowerLoom-Vault\": \"{PowerLoomHost.Vault}\"", written);
        Assert.DoesNotContain("http://old", written);
    }

    [Fact]
    public async Task PowerLoom_s_own_file_follows_the_template_and_the_user_s_files_stay_as_they_are()
    {
        var initializer = host.Host.Services.GetRequiredService<VaultInitializer>();
        var tools = Path.Combine(host.VaultRoot, "POWERLOOM.md");
        var agents = Path.Combine(host.VaultRoot, "AGENTS.md");

        await File.WriteAllTextAsync(tools, "old tools");
        await File.WriteAllTextAsync(agents, "the user's rules");

        var changed = await initializer.RefreshOwnedFilesAsync(PowerLoomHost.Vault, CancellationToken.None);
        var changedAgain = await initializer.RefreshOwnedFilesAsync(PowerLoomHost.Vault, CancellationToken.None);

        Assert.True(changed);
        Assert.False(changedAgain);
        Assert.Equal($"# PowerLoom tools for {PowerLoomHost.HostRoot}/{PowerLoomHost.Vault}", (await File.ReadAllTextAsync(tools)).TrimEnd());
        Assert.Equal("the user's rules", await File.ReadAllTextAsync(agents));
    }

    [Fact]
    public async Task Adding_it_again_is_a_conflict_and_adoa_s_own_vault_is_refused()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddVaultRequest(PowerLoomHost.Vault)).ToUrl("/api/vaults");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddVaultRequest("powerloom-backlog")).ToUrl("/api/vaults");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
    }

    private async Task<bool> IsActiveVaultAsync(string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.Vaults.AnyAsync(vault => vault.Name == name && vault.RemovedAt == null);
    }
}
