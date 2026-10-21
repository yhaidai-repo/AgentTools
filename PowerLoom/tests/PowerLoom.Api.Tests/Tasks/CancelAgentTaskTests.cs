using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Tasks.CloseItem.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class CancelAgentTaskTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task An_open_or_blocked_agent_task_of_any_kind_is_cancelled_and_a_running_one_is_refused()
    {
        await SeedAsync();

        var meeting = await Tracked(() => host.Host.PostJson(new CloseRequest(null, CloseDecision.Cancel, null, false), "/api/items/MT-9101/close").Receive<ClosedItem>());
        var docs = await Tracked(() => host.Host.PostJson(new CloseRequest(null, CloseDecision.Cancel, null, false), "/api/items/WT-9101/close").Receive<ClosedItem>());
        var running = await CloseRefusedAsync("AT-9101", CloseDecision.Cancel, 409);
        var done = await CloseRefusedAsync("AT-9102", CloseDecision.Done, 400);
        var items = await LoadItemsAsync();

        Assert.Equal(("cancelled", "cancelled"), (meeting.Status, docs.Status));
        Assert.Equal((ItemStatus.Cancelled, ItemStatus.Cancelled), (items["MT-9101"], items["WT-9101"]));
        Assert.Contains("only an open or blocked agent task can be cancelled", running);
        Assert.Equal(ItemStatus.InProgress, items["AT-9101"]);
        Assert.Contains("doesn't apply to an agent task", done);
        Assert.Equal(ItemStatus.Open, items["AT-9102"]);
    }

    private async Task<string> CloseRefusedAsync(string itemId, CloseDecision decision, int statusCode)
    {
        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new CloseRequest(null, decision, null, false)).ToUrl($"/api/items/{itemId}/close");
            scenario.StatusCodeShouldBe(statusCode);
        });

        return await refused.ReadAsTextAsync();
    }

    private async Task<T> Tracked<T>(Func<Task<T?>> call)
    {
        T? value = default;

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => value = await call()));

        return value!;
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(AgentTask("MT-9101", ItemKind.Meeting, ItemStatus.Open));
        db.LocalItems.Add(AgentTask("WT-9101", ItemKind.Docs, ItemStatus.Blocked));
        db.LocalItems.Add(AgentTask("AT-9101", ItemKind.Research, ItemStatus.InProgress));
        db.LocalItems.Add(AgentTask("AT-9102", ItemKind.Research, ItemStatus.Open));

        await db.SaveChangesAsync();
    }

    private static LocalItem AgentTask(string id, ItemKind kind, ItemStatus status)
    {
        return new LocalItem { Id = id, Kind = kind, Vault = PowerLoomHost.Vault, Title = id, Status = status, Assignee = "agent:*", HeldBy = "[]" };
    }

    private async Task<Dictionary<string, ItemStatus>> LoadItemsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.Id.EndsWith("-9101") || item.Id == "AT-9102").ToDictionaryAsync(item => item.Id, item => item.Status);
    }
}
