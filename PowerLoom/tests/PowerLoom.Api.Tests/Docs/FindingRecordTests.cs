using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Docs;

[Collection(PowerLoomCollection.Name)]
public sealed class FindingRecordTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_submitted_finding_goes_into_the_register_and_closes()
    {
        var id = await StoreFindingAsync("FND-9001", "Sync drops the last page");

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => PublishAsync(bus, RecordKind.OpenQuestion, id));

        var finding = await LoadAsync(id);
        var capture = host.Host.Services.GetRequiredService<FakeVaultCapture>();

        Assert.Equal(ItemStatus.Done, finding.Status);
        Assert.Equal($"Recorded as {FakeVaultCapture.RecordId} in adoa-open-questions.", finding.Resolution);
        Assert.NotNull(finding.ClosedAt);
        Assert.Equal("questions", capture.Added.Single(entry => entry.Record.Title == "Sync drops the last page").Record.Kind);
        Assert.Equal(["in-progress", "done"], await HistoryOfAsync(id));
    }

    [Fact]
    public async Task A_rejected_record_leaves_the_finding_open_with_the_reason()
    {
        var id = await StoreFindingAsync("FND-9002", "reject: no such project");

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => PublishAsync(bus, RecordKind.KnownIssue, id));

        var finding = await LoadAsync(id);

        Assert.Equal(ItemStatus.Open, finding.Status);
        Assert.Equal("Not recorded: unknown project", finding.Resolution);
        Assert.Null(finding.ClosedAt);
    }

    private static Task PublishAsync(IMessageContext bus, RecordKind kind, string id) => bus.PublishAsync(new AddRecord(PowerLoomHost.Vault, kind, id)).AsTask();

    private async Task<string> StoreFindingAsync(string id, string title)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Title = title,
            Assignee = "human",
            Vault = PowerLoomHost.Vault,
            Kind = ItemKinds.Finding,
            Status = ItemStatus.InProgress,
            Body = "the finding's text",
            Data = """{"type":"question","project":"adoa","default":["keep"],"options":["a","b"]}""",
        });
        await db.SaveChangesAsync();

        return id;
    }

    private async Task<LocalItem> LoadAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<string[]> HistoryOfAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var row = await db.StatusHistories.AsNoTracking().SingleAsync(entry => entry.EntityId == id);

        return [row.FromStatus ?? "", row.ToStatus];
    }
}
