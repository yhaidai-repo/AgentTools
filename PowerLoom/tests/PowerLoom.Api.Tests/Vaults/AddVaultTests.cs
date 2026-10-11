using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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
        Assert.Equal(["draft/", ".usage/", ".obsidian/", "AGENTS.md"], added.Created);
        Assert.Contains($"vault at {PowerLoomHost.HostRoot}/notes-vault", agents);
        Assert.DoesNotContain("{{", agents);
        Assert.True(await IsActiveVaultAsync("notes-vault"));
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
