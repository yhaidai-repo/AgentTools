using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Agents;

// An agent takes the tasks pinned to it and the tasks for any agent of a type it handles, so two agents of one type
// (research and Better Research) can both take a PBI's research tasks (user decision 2026-10-13). The agent ids are this
// test's own: the tasks stay open in the shared database, and a real agent's dispatch in another test must not see them.
[Collection(PowerLoomCollection.Name)]
public sealed class TaskTypeDispatchTests(PowerLoomHost host)
{
    private const int AdoId = 63005;
    private const string AnyResearch = "AT-63005-001";
    private const string PinnedResearch = "AT-63005-002";
    private const string PinnedBetter = "AT-63005-003";
    private const string AnyDesign = "DT-63005-001";
    private const string Classic = "type-test-research";
    private const string Better = "type-test-better-research";

    [Fact]
    public async Task Each_agent_gets_its_pinned_tasks_and_the_open_ones_of_the_types_it_handles()
    {
        await SeedAsync();

        var research = await OpenTaskIdsAsync(Classic, ["research"]);
        var better = await OpenTaskIdsAsync(Better, ["research"]);
        var none = await OpenTaskIdsAsync(Better, []);

        Assert.Equal([AnyResearch, PinnedResearch], research);
        Assert.Equal([AnyResearch, PinnedBetter], better);
        Assert.Equal([PinnedBetter], none);
    }

    private async Task<List<string>> OpenTaskIdsAsync(string agentId, IReadOnlyList<string> handles)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var tasks = await OpenAgentTasks.ListAsync(db, agentId, handles, CancellationToken.None);

        return tasks.Where(task => task.PbiId == AdoId).Select(task => task.Id).Order().ToList();
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Task types PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.NeedsResearch, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(Task(AnyResearch, ItemKinds.Research, AgentStages.AnyAgent));
        db.LocalItems.Add(Task(PinnedResearch, ItemKinds.Research, AgentStages.AssigneeOf(Classic)));
        db.LocalItems.Add(Task(PinnedBetter, ItemKinds.Research, AgentStages.AssigneeOf(Better)));
        db.LocalItems.Add(Task(AnyDesign, ItemKinds.Design, AgentStages.AnyAgent));

        await db.SaveChangesAsync();
    }

    private static LocalItem Task(string id, string kind, string assignee) => new() { Id = id, Kind = kind, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = id, Status = ItemStatus.Open, Assignee = assignee, HeldBy = "[]" };
}
