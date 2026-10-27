using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class ItemIdReservationTests(PowerLoomHost host)
{
    [Fact]
    public async Task S2_04_Concurrent_writers_reserve_unique_ids_and_never_reuse_deleted_ids()
    {
        const string stem = "REPAIR-980140-";
        using (var scope = host.Host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            db.Vaults.Add(new Vault { Name = "id-reservation-vault", Features = "{}" });
            ReviewFixSeed.Item(db, stem + "998", PowerLoomHost.Vault);
            await db.SaveChangesAsync();
        }
        var allocated = await Task.WhenAll(Enumerable.Range(0, 16).Select(async index =>
        {
            using var scope = host.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            var id = await ItemIds.NextScopedAsync(db, stem, CancellationToken.None);
            ReviewFixSeed.Item(db, id, index % 2 == 0 ? PowerLoomHost.Vault : "id-reservation-vault");
            await db.SaveChangesAsync();
            return id;
        }));
        Assert.Equal(16, allocated.Distinct().Count());
        Assert.Contains(stem + "999", allocated);
        Assert.Contains(stem + "1000", allocated);
        using var finalScope = host.Host.Services.CreateScope();
        var final = finalScope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await final.LocalItems.Where(row => row.Id.StartsWith(stem)).ExecuteDeleteAsync();
        Assert.Equal(stem + "1015", await ItemIds.NextScopedAsync(final, stem, CancellationToken.None));
        Assert.Equal("REPAIR-980141-001", await ItemIds.NextAsync(final, "REPAIR", 980141, CancellationToken.None));
        Assert.Equal("OTHER-980141-001", await ItemIds.NextAsync(final, "OTHER", 980141, CancellationToken.None));
        var global = await ItemIds.NextGlobalAsync(final, "REPAIRGLOBAL", CancellationToken.None);
        Assert.Equal("REPAIRGLOBAL-001", global);
    }
}
