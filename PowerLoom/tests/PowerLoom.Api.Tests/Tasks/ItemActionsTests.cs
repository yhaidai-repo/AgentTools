using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Tasks.CloseItem.Models;
using PowerLoom.Features.Tasks.DeleteItem.Models;
using PowerLoom.Features.Tasks.ReportBug.Models;
using PowerLoom.Features.Tasks.RerunTasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class ItemActionsTests(PowerLoomHost host)
{
    private const int AdoId = 63001;

    private const int TestedAdoId = 63093;

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_question_is_answered_a_task_deleted_a_finished_task_rerun_and_a_bug_reported()
    {
        await SeedAsync();

        var closed = await Tracked(() => host.Host.PostJson(new CloseRequest(AdoId, CloseDecision.Answer, "Confirm", false), $"/api/items/Q-{AdoId}-001/close").Receive<ClosedItem>());
        var deleted = await Tracked(() => DeleteAsync($"HT-{AdoId}-001"));
        var rerun = await Tracked(() => host.Host.PostJson(new RerunRequest([new TaskRef(AdoId, $"AT-{AdoId}-001"), new TaskRef(AdoId, "nope")]), "/api/tasks/rerun").Receive<RerunResult>());
        var bug = await Tracked(() => host.Host.PostJson(new ReportBugRequest($"https://dev.azure.com/org/proj/_workitems/edit/{AdoId}", "Save fails", "Steps…", null, "cli"), "/api/bugs").Receive<ReportedBug>());
        var items = await LoadItemsAsync();
        var bugRow = await LoadBugAsync(bug.Value!.AdoId);

        Assert.Equal("answered", closed.Value!.Status);
        Assert.Equal((ItemStatus.Answered, "Confirm"), (items[$"Q-{AdoId}-001"].Status, items[$"Q-{AdoId}-001"].Resolution));
        Assert.Equal(RepoSource.UserConfirmed, await RepoSourceAsync("r-conf"));
        Assert.Equal(ItemStatus.Deleted, items[deleted.Value!.ItemId].Status);
        Assert.Equal([$"AT-{AdoId}-001"], rerun.Value!.Reopened);
        Assert.Single(rerun.Value.Refused);
        Assert.Equal((ItemStatus.Open, 0), (items[$"AT-{AdoId}-001"].Status, items[$"AT-{AdoId}-001"].Attempts));
        Assert.True(bug.Value.AdoId >= 9000001);
        Assert.Equal((AdoId, BugSource.Internal, "cli"), (bugRow.PbiId, bugRow.Source, bugRow.ReportedBy));
        Assert.Equal(bug.Value.AdoId, bug.Session.Executed.SingleMessage<PreparePbi>().AdoId);
        Assert.Equal(3, closed.Session.Executed.MessagesOf<PbiChanged>().Count() + deleted.Session.Executed.MessagesOf<PbiChanged>().Count() + rerun.Session.Executed.MessagesOf<PbiChanged>().Count());
    }

    private async Task<(T? Value, ITrackedSession Session)> Tracked<T>(Func<Task<T?>> call)
    {
        T? value = default;
        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => value = await call()));

        return (value, session);
    }

    [Fact]
    public async Task A_test_task_is_deleted_and_a_test_report_is_not()
    {
        await SeedTestTaskAsync();

        await DeleteAsync($"TT-{TestedAdoId}-001", TestedAdoId);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new DeleteItemRequest(TestedAdoId)).ToUrl($"/api/items/TR-{TestedAdoId}-001");
            scenario.StatusCodeShouldBe(404);
        });

        Assert.Equal(ItemStatus.Deleted, (await LoadItemsAsync(TestedAdoId))[$"TT-{TestedAdoId}-001"].Status);
    }

    private async Task<DeletedItem?> DeleteAsync(string itemId, int adoId = AdoId)
    {
        var response = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new DeleteItemRequest(adoId)).ToUrl($"/api/items/{itemId}");
            scenario.StatusCodeShouldBeOk();
        });

        return response.ReadAsJson<DeletedItem>();
    }

    private async Task SeedTestTaskAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = TestedAdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Tested PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Testing, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = $"TT-{TestedAdoId}-001", Kind = ItemKinds.Test, PbiId = TestedAdoId, Vault = PowerLoomHost.Vault, Title = "Test it", Status = ItemStatus.Open, Assignee = "agent:autotest", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"TR-{TestedAdoId}-001", Kind = ItemKinds.TestReport, PbiId = TestedAdoId, Vault = PowerLoomHost.Vault, Title = "Report", Status = ItemStatus.Done, Assignee = "agent:autotest", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Items PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Refining, SyncedAt = DateTime.UtcNow });
        db.Repos.Add(new Repo { Id = "r-conf", AdoProject = "Proj", Name = "ConfRepo", RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });
        db.LocalItems.Add(new LocalItem { Id = $"Q-{AdoId}-001", Kind = ItemKinds.Question, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Which repos?", Status = ItemStatus.Open, Assignee = "human", Body = "Repos?", Data = """{"key":"repos:ConfRepo"}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"HT-{AdoId}-001", Kind = ItemKinds.Human, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Do it", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"AT-{AdoId}-001", Kind = ItemKinds.Research, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = ItemStatus.Done, Assignee = "agent:research", Attempts = 2, HeldBy = "[]" });
        db.PbiRepos.Add(new PbiRepo { PbiId = AdoId, RepoId = "r-conf", Source = RepoSource.AgentAssumed });

        await db.SaveChangesAsync();
    }

    private async Task<Dictionary<string, LocalItem>> LoadItemsAsync(int adoId = AdoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId).ToDictionaryAsync(item => item.Id);
    }

    private async Task<Bug> LoadBugAsync(int workItemId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Bugs.AsNoTracking().SingleAsync(bug => bug.WorkItemId == workItemId);
    }

    private async Task<RepoSource> RepoSourceAsync(string repoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PbiRepos.AsNoTracking().Where(row => row.PbiId == AdoId && row.RepoId == repoId).Select(row => row.Source).SingleAsync();
    }
}
