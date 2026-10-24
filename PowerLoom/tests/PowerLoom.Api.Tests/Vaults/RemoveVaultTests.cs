using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Api.Tests.Vaults;

[Collection(PowerLoomCollection.Name)]
public sealed class RemoveVaultTests(PowerLoomHost host)
{
    [Fact]
    public async Task An_empty_second_vault_is_removed_and_its_row_kept()
    {
        await AddVaultRowAsync("spare-vault");

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url("/api/vaults/spare-vault");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.NotNull(await RemovedAtAsync("spare-vault"));
    }

    [Fact]
    public async Task An_unknown_vault_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url("/api/vaults/no-such-vault");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task AddVaultRowAsync(string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.Vaults.Add(new Vault { Name = name, Features = "{}" });
        await db.SaveChangesAsync();
    }

    private async Task<DateTime?> RemovedAtAsync(string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.Vaults.Where(vault => vault.Name == name).Select(vault => vault.RemovedAt).SingleAsync();
    }
}
