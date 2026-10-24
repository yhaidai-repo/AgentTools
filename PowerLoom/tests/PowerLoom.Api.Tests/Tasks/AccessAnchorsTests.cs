using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Tasks.CloseItem.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// An access request (a tool refused for access → a human task) anchors the agent task: held while the request is open,
// run again when it's done, the anchor forgotten when it's cancelled (user decisions 2026-10-13).
[Collection(PowerLoomCollection.Name)]
public sealed class AccessAnchorsTests(PowerLoomHost host)
{
    private const int AdoId = 63002;
    private const string Sql = "HT-63002-001";
    private const string Confluence = "HT-63002-002";
    private const string Research = "AT-63002-001";
    private const string Design = "DT-63002-001";

    [Fact]
    public async Task An_anchored_task_waits_for_its_open_access_requests_cancel_forgets_one_and_done_reruns()
    {
        await SeedAsync();

        var held = await ReasonsOfAsync(Research);

        await host.Host.PostJson(new CloseRequest(AdoId, CloseDecision.Cancel, null, false), $"/api/items/{Confluence}/close").Receive<ClosedItem>();

        var afterCancel = await ReasonsOfAsync(Research);
        var anchorsAfterCancel = (await ItemAsync(Research)).Data;

        await host.Host.PostJson(new CloseRequest(AdoId, CloseDecision.Done, "Login fixed", false), $"/api/items/{Sql}/close").Receive<ClosedItem>();

        var research = await ItemAsync(Research);
        var design = await ItemAsync(Design);

        Assert.Equal([$"Waiting for access: {Sql}, {Confluence}"], held);
        Assert.Equal([$"Waiting for access: {Sql}"], afterCancel);
        Assert.Equal([Sql], AnchorsOf(anchorsAfterCancel));
        Assert.Equal((ItemStatus.Open, 0), (research.Status, research.Attempts));
        Assert.Equal((ItemStatus.Open, 0), (design.Status, design.Attempts));
        Assert.Empty(await ReasonsOfAsync(Research));
    }

    // jsonb normalizes spacing, so the anchors are compared parsed.
    private static List<string> AnchorsOf(string? data)
    {
        using var document = JsonDocument.Parse(data ?? "{}");

        return document.RootElement.GetProperty("rerunAfter").EnumerateArray().Select(anchor => anchor.GetString()!).ToList();
    }

    private async Task<List<string>> ReasonsOfAsync(string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == taskId);

        return await TaskValidation.ValidateAsync(db, task, "research", [], true, CancellationToken.None);
    }

    private async Task<LocalItem> ItemAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Anchors PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Researching, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = Sql, Kind = ItemKinds.Human, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Access to pvs-dev for research", Status = ItemStatus.Open, Assignee = "human", Data = """{"accessRequest":{"kind":"sql","resource":"pvs-dev","agentTaskId":"AT-63002-001"}}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Confluence, Kind = ItemKinds.Human, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Access to Confluence for research", Status = ItemStatus.Open, Assignee = "human", Data = """{"accessRequest":{"kind":"confluence","resource":"x.atlassian.net","agentTaskId":"AT-63002-001"}}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Research, Kind = ItemKinds.Research, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = ItemStatus.Done, Assignee = "agent:research", Attempts = 1, Data = $$$"""{"rerunAfter":["{{{Sql}}}","{{{Confluence}}}"]}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Design, Kind = ItemKinds.Design, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Design", Status = ItemStatus.Blocked, Assignee = "agent:design", Attempts = 3, Data = $$$"""{"rerunAfter":["{{{Sql}}}"]}""", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }
}
