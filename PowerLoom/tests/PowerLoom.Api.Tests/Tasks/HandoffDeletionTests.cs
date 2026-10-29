using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Pbis.Delete.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// Deleting a PBI deletes its runs and items; the hand-offs that point at them go or let go, not a 500.
[Collection(PowerLoomCollection.Name)]
public sealed class HandoffDeletionTests(PowerLoomHost host)
{
    private const int AdoId = 63201;

    [Fact]
    public async Task Deleting_a_PBI_removes_its_hand_offs_with_their_runs_and_items()
    {
        await SeedAsync();

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new DeleteRequest([AdoId])).ToUrl("/api/pbis");
            scenario.StatusCodeShouldBeOk();
        });

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        Assert.Equal(0, await db.Database.SqlQuery<int>($"select count(*)::int as \"Value\" from handoff where from_task_id like {"%-" + AdoId + "-%"}").SingleAsync());
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var (planning, review) = ($"PT-{AdoId}-001", $"HT-{AdoId}-001");
        var run = new AgentRun { PbiId = AdoId, ItemId = planning, Stage = "planning", Outcome = RunOutcome.Success };

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Handed off PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.ReadyForDesign, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = planning, Kind = "planning", PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Plan", Status = ItemStatus.Done, Assignee = "agent:planning", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = review, Kind = ItemKinds.Human, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Review the plan", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });
        db.AgentRuns.Add(run);
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlAsync($"insert into handoff (from_task_id, from_agent, from_run_id, to_kind, to_item_id, intent, gate, body) values ({planning}, 'planning', {run.Id}, 'human', {review}, 'review', 'none', 'Review the plan.')");
    }
}
