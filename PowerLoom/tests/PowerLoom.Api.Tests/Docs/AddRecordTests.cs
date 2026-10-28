using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
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
    public async Task A_submitted_finding_goes_into_the_register_closes_and_renders_its_pbi()
    {
        const int adoId = 68501;
        var findingId = await StoreFindingAsync(adoId);

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddRecordRequest(RecordKind.KnownIssue, findingId)).ToUrl("/api/records");
            scenario.StatusCodeShouldBe(202);
        }));
        var finding = await LoadItemAsync(findingId);
        var added = host.Host.Services.GetRequiredService<FakeVaultCapture>().Added.Single(entry => entry.Record.Title == "Found it");

        Assert.Equal((ItemStatus.Done, $"Recorded as {FakeVaultCapture.RecordId} in pos-known-issues."), (finding.Status, finding.Resolution));
        Assert.Equal(("pos", "issues"), (added.Record.Project, added.Record.Kind));
        Assert.Equal(adoId, session.Executed.SingleMessage<PbiChanged>().AdoId);
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
            Project = "PowerLoom",
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

    // A finding the user submitted (the web's startFindingSubmit): in progress, with the submit data.
    private async Task<string> StoreFindingAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var id = $"F-{adoId}-001";

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Refining, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKinds.Finding, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Found it", Body = "The rule is unclear.", Status = ItemStatus.InProgress, Assignee = "human", Data = """{"type":"issue","project":"pos","default":["Keep it"],"options":[]}""", HeldBy = "[]" });
        await db.SaveChangesAsync();

        return id;
    }

    private async Task<LocalItem> LoadItemAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<string?> RecordIdOfAsync(int id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.WwwRecords.Where(row => row.Id == id).Select(row => row.RecordId).SingleAsync();
    }
}
