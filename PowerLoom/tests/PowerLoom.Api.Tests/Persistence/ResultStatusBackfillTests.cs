using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Migrations;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Persistence;

[Collection(PowerLoomCollection.Name)]
public sealed class ResultStatusBackfillTests(PowerLoomHost host)
{
    [Theory]
    [InlineData("{\"status\":\"partial\"}", "partial", 1)]
    [InlineData("{\"result\":{\"status\":\"partial\"}}", "partial", 2)]
    [InlineData("{\"result\":{\"status\":\"blocked\"}}", "blocked", 3)]
    [InlineData("{\"report\":{\"status\":\"not_found\"}}", "partial", 4)]
    [InlineData("{\"status\":\"complete\",\"result\":{\"status\":\"blocked\"}}", "complete", 5)]
    [InlineData("{\"report\":{\"status\":\"complete\"}}", "complete", 6)]
    public async Task S2_05_Fresh_and_already_applied_backfills_read_the_same_status(string data, string expected, int test)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var legacy = ReviewFixSeed.Item(db, $"RESULTREPAIR-{test}", PowerLoomHost.Vault, ItemKinds.ResearchResult);
        legacy.Data = data;
        legacy.Body = $"backfill sentinel {test}";
        await db.SaveChangesAsync();
        var insert = Assert.IsType<SqlOperation>(new RunResultBackfill().UpOperations[0]);
        await db.Database.ExecuteSqlRawAsync(insert.Sql);
        var result = await db.RunResults.SingleAsync(row => row.Body == legacy.Body);
        Assert.Equal(expected, result.Status);

        // Simulate a row produced by the buggy, already-applied migration, alongside a later live result.
        result.Status = "complete";
        var live = new RunResult { Agent = "test", Status = "complete", Body = "later live result", Data = data };
        db.RunResults.Add(live);
        await db.SaveChangesAsync();
        foreach (var operation in new RepairBackfilledResultStatus().UpOperations.OfType<SqlOperation>())
            await db.Database.ExecuteSqlRawAsync(operation.Sql);
        await db.Entry(result).ReloadAsync();
        await db.Entry(live).ReloadAsync();
        Assert.Equal(expected, result.Status);
        Assert.Equal("complete", live.Status);
        await transaction.RollbackAsync();
    }
}
