using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Tasks;

// A task type of its own that an agent created in the UI handles (user decision 2026-10-24): creatable like a built-in
// type, numbered XT, and taken by the agent that handles it. The agent and its tasks are removed again: the database is
// shared, and the migrator test casts local_item.kind back to the old enum, which never had this type.
[Collection(PowerLoomCollection.Name)]
public sealed class CustomTaskTypeTests(PowerLoomHost host)
{
    private const int AdoId = 64790;
    private const string Agent = "custom-type-test";
    private const string Type = "security-review";
    private const string Criteria = "Lists every finding";

    [Fact]
    public async Task A_type_an_agent_handles_is_created_for_any_agent_and_numbered_XT_with_or_without_a_PBI()
    {
        await SeedAgentAsync();
        await SeedPbiAsync();

        try
        {
            var withoutPbi = await host.Host.PostJson(Request(Type), "/api/tasks").Receive<CreatedTask>();
            var withPbi = await host.Host.PostJson(Request(Type, pbi: AdoId.ToString()), "/api/tasks").Receive<CreatedTask>();
            var task = await LoadAsync(withoutPbi!.Id);
            var data = JsonDocument.Parse(task.Data!).RootElement;

            Assert.Matches("^XT-[0-9]{3}$", task.Id);
            Assert.Equal(($"XT-{AdoId}-001", (int?)AdoId), (withPbi!.Id, withPbi.PbiId));
            Assert.Equal((Type, "agent:*", ItemStatus.Open, (int?)null), (task.Kind, task.Assignee, task.Status, task.PbiId));
            Assert.Equal(("user", Criteria, Criteria), (data.GetProperty("createdBy").GetString(), data.GetProperty("doneWhen").GetString(), data.GetProperty("goal").GetString()));
        }
        finally
        {
            await RemoveSeedAsync();
        }
    }

    [Fact]
    public async Task A_type_no_agent_handles_is_refused_and_the_handled_ones_are_listed()
    {
        await SeedAgentAsync();

        try
        {
            var refused = await PostAsync(Request("security-audit"), 400);

            Assert.Contains("Unknown task type security-audit; one of: refinement, research, design, docs, vault-review, test, security-review.", refused);
        }
        finally
        {
            await RemoveSeedAsync();
        }
    }

    [Fact]
    public async Task The_agent_that_handles_the_type_gets_its_open_tasks_and_another_does_not()
    {
        await SeedPbiAsync();
        await SeedTaskAsync();

        try
        {
            var handling = await OpenTaskIdsAsync([Type]);
            var other = await OpenTaskIdsAsync(["research"]);

            Assert.Equal([$"XT-{AdoId}-001"], handling);
            Assert.Empty(other);
        }
        finally
        {
            await RemoveSeedAsync();
        }
    }

    private static CreateTaskRequest Request(string type, string? pbi = null)
    {
        return new CreateTaskRequest(PowerLoomHost.Vault, type, "Check the endpoints", "Look for missing auth", Criteria, pbi, null, null);
    }

    private async Task<string> PostAsync(CreateTaskRequest request, int status)
    {
        var result = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request).ToUrl("/api/tasks");
            scenario.StatusCodeShouldBe(status);
        });

        return await result.ReadAsTextAsync();
    }

    private async Task<List<string>> OpenTaskIdsAsync(IReadOnlyList<string> handles)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var tasks = await OpenAgentTasks.ListAsync(db, Agent, handles, CancellationToken.None);

        return tasks.Where(task => task.PbiId == AdoId).Select(task => task.Id).ToList();
    }

    private async Task SeedAgentAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var definition = JsonSerializer.Serialize(new { id = Agent, label = "Custom type test", enabled = true, handles = new[] { Type, "review" } });

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.ExecuteSqlAsync($"INSERT INTO agent_config.agent (id, definition) VALUES ({Agent}, {definition}::jsonb) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition");
    }

    private async Task SeedPbiAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (await db.WorkItems.AnyAsync(row => row.AdoId == AdoId))
            return;

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Custom type PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    private async Task SeedTaskAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem { Id = $"XT-{AdoId}-001", Kind = Type, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Security review", Status = ItemStatus.Open, Assignee = AgentStages.AnyAgent, HeldBy = "[]" });
        await db.SaveChangesAsync();
    }

    private async Task RemoveSeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.LocalItems.Where(item => item.Kind == Type).ExecuteDeleteAsync();
        await db.Database.ExecuteSqlAsync($"DELETE FROM agent_config.agent WHERE id = {Agent}");
    }

    private async Task<LocalItem> LoadAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }
}
