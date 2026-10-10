using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Docs;

[Collection(PowerLoomCollection.Name)]
public sealed class AddRecordTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_posted_www_record_is_appended_to_the_vault_s_log()
    {
        await File.WriteAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md"), WwwLogTests.EmptyLog);
        var id = await StoreWwwRecordAsync("Sync skipped a PBI");

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddRecordRequest(RecordKind.Www, id.ToString())).ToUrl("/api/records");
            scenario.StatusCodeShouldBe(202);
        }));

        var log = await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md"));

        Assert.Contains("## WWW-001 Sync skipped a PBI", log);
        Assert.Equal("WWW-001", await RecordIdOfAsync(id));
    }

    [Fact]
    public async Task An_unknown_source_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddRecordRequest(RecordKind.Www, "999999")).ToUrl("/api/records");
            scenario.StatusCodeShouldBe(404);
        });
    }

    private async Task<int> StoreWwwRecordAsync(string title)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var row = new WwwRecord
        {
            Vault = PowerLoomHost.Vault,
            Project = "adoa",
            Title = title,
            Kind = "complaint",
            Planned = "Every sprint PBI synced",
            Happened = "One was skipped",
            Fault = "Agent",
            Source = "test",
        };

        db.WwwRecords.Add(row);
        await db.SaveChangesAsync();

        return row.Id;
    }

    private async Task<string?> RecordIdOfAsync(int id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.WwwRecords.Where(row => row.Id == id).Select(row => row.RecordId).SingleAsync();
    }
}
