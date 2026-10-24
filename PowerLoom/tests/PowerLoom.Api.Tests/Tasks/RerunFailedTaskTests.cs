using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Tasks.RerunTasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class RerunFailedTaskTests(PowerLoomHost host)
{
    private const int AdoId = 63091;

    [Fact]
    public async Task A_failed_or_held_open_task_is_rerun_with_its_attempts_and_reasons_reset_and_a_fresh_or_running_one_is_refused()
    {
        await SeedAsync();

        RerunResult? rerun = null;

        // Waits for the PBI changes the re-run publishes, so none spills into the next test's tracking.
        await host.Host.Services.TrackActivity().Timeout(TimeSpan.FromSeconds(30)).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => rerun = await host.Host.PostJson(new RerunRequest([Ref("001"), Ref("002"), Ref("003"), Ref("004")]), "/api/tasks/rerun").Receive<RerunResult>()));
        var items = await LoadItemsAsync();

        Assert.Equal([Id("001"), Id("002")], rerun!.Reopened);
        Assert.Equal(2, rerun.Refused.Count);
        Assert.Equal((ItemStatus.Open, 0, "[]"), (items[Id("001")].Status, items[Id("001")].Attempts, items[Id("001")].HeldBy));
        Assert.Equal((ItemStatus.Open, 0, "[]"), (items[Id("002")].Status, items[Id("002")].Attempts, items[Id("002")].HeldBy));
        Assert.Equal(ItemStatus.InProgress, items[Id("004")].Status);
    }

    private static TaskRef Ref(string number) => new(AdoId, Id(number));

    private static string Id(string number) => $"AT-{AdoId}-{number}";

    // 001 failed once, 002 held by a rate limit, 003 fresh, 004 running.
    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Rerun PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Refining, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(Task("001", ItemStatus.Open, attempts: 1, heldBy: "[]"));
        db.LocalItems.Add(Task("002", ItemStatus.Open, attempts: 0, heldBy: """["rate limited; agents are paused until the limit resets"]"""));
        db.LocalItems.Add(Task("003", ItemStatus.Open, attempts: 0, heldBy: "[]"));
        db.LocalItems.Add(Task("004", ItemStatus.InProgress, attempts: 1, heldBy: "[]"));

        await db.SaveChangesAsync();
    }

    private static LocalItem Task(string number, ItemStatus status, int attempts, string heldBy) =>
        new() { Id = Id(number), Kind = ItemKinds.Research, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = status, Assignee = "agent:*", Attempts = attempts, HeldBy = heldBy };

    private async Task<Dictionary<string, LocalItem>> LoadItemsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == AdoId).ToDictionaryAsync(item => item.Id);
    }
}
