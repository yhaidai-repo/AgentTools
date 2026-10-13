using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class SchedulesTests(PowerLoomHost host)
{
    [Fact]
    public async Task A_goal_schedule_creates_its_task_once_until_it_is_done()
    {
        await SeedRepoAsync("r-sched", "SchedRepo");

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new ScheduleInput(null, "Nightly check", "research", PowerLoomHost.Vault, "0 2 * * *", true, "Look around", ["Nope"])).ToUrl("/api/task-schedules");
            scenario.StatusCodeShouldBe(400);
        });
        var saved = await host.Host.PutJson(new ScheduleInput(null, "Nightly check", "research", PowerLoomHost.Vault, "0 2 * * *", true, "Look around", ["SchedRepo"]), "/api/task-schedules").Receive<SavedSchedule>();
        var first = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        var second = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved.Id}/tick").Receive<TickResult>();
        var task = await LoadAsync(first!.Result.Split(' ')[0]);

        Assert.Contains("Not among the vault's enabled repositories: Nope.", await refused.ReadAsTextAsync());
        Assert.Equal((ItemKind.Goal, "agent:research", "Look around", ItemStatus.Open), (task.Kind, task.Assignee, task.Body, task.Status));
        Assert.Contains($"\"scheduleId\": {saved.Id}", task.Data);
        Assert.Equal($"{task.Id} still waits; no new task", second!.Result);
        Assert.Contains((await CronEntriesAsync()), entry => entry.Key == $"task-schedule:{saved.Id}" && entry.Message is CreateScheduledTask created && created.ScheduleId == saved.Id);
    }

    // A schedule by task type (user decision 2026-10-14): each tick creates the task the form described, for any agent
    // that takes the type.
    [Fact]
    public async Task A_schedule_by_task_type_creates_the_described_task_for_any_agent_once_until_it_is_done()
    {
        await SeedRepoAsync("r-typed", "TypedRepo");

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(TypedInput("research", repos: ["Nope"])).ToUrl("/api/task-schedules");
            scenario.StatusCodeShouldBe(400);
        });
        var saved = await host.Host.PutJson(TypedInput("research", repos: ["TypedRepo"]), "/api/task-schedules").Receive<SavedSchedule>();
        var first = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        var second = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved.Id}/tick").Receive<TickResult>();
        var task = await LoadAsync(first!.Result.Split(' ')[0]);

        Assert.Contains("Not among the vault's enabled repositories: Nope.", await refused.ReadAsTextAsync());
        Assert.Equal(("*", "research"), (saved.AgentId, saved.TaskType));
        Assert.StartsWith("GT-", task.Id);
        Assert.Equal((ItemKind.Research, "agent:*", "Weekly look", "Check the retries", ItemStatus.Open), (task.Kind, task.Assignee, task.Title, task.Body, task.Status));
        Assert.Contains($"\"scheduleId\": {saved.Id}", task.Data);
        Assert.Contains("\"doneWhen\": \"Lists every retry\"", task.Data);
        Assert.Equal($"{task.Id} still waits; no new task", second!.Result);
    }

    [Fact]
    public async Task A_refinement_schedule_reports_the_refinement_still_open_on_its_PBI()
    {
        const int adoId = 64715;

        await SeedPbiWithOpenRefinementAsync(adoId);

        var saved = await host.Host.PutJson(TypedInput("refinement", pbi: adoId.ToString()), "/api/task-schedules").Receive<SavedSchedule>();
        var ticked = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();

        Assert.Equal($"no task: RT-{adoId}-001 is still open on PBI-{adoId}.", ticked!.Result);
    }

    [Fact]
    public async Task The_vault_review_schedule_makes_a_task_only_when_the_vault_has_candidates()
    {
        Directory.CreateDirectory(Path.Combine(host.VaultRoot, "proj"));
        await File.WriteAllTextAsync(Path.Combine(host.VaultRoot, "proj", "note.md"), "# Note\n\nSee [[missing-note]].\n");

        var saved = await host.Host.PutJson(new ScheduleInput(null, $"Vault review of {PowerLoomHost.Vault}", "vault-review", PowerLoomHost.Vault, "0 6 * * 1", true, null, null), "/api/task-schedules").Receive<SavedSchedule>();
        var ticked = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        var task = await LoadAsync(ticked!.Result.Split(' ')[0]);

        Assert.StartsWith("VR-", task.Id);
        Assert.Equal((ItemKind.VaultReview, "agent:vault-review"), (task.Kind, task.Assignee));
        Assert.Contains($"Review the vault {PowerLoomHost.Vault}:", task.Title);
        Assert.Contains($"\"vaults\": [\"{PowerLoomHost.Vault}\"]", task.Data);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/task-schedules/{saved.Id}");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.False(await ExistsAsync(saved.Id));
    }

    private static ScheduleInput TypedInput(string type, string? pbi = null, List<string>? repos = null)
    {
        return new ScheduleInput(null, "Weekly look", "", PowerLoomHost.Vault, "0 7 * * 1", true, null, repos, type, "Check the retries", "Lists every retry", pbi, null);
    }

    private async Task SeedPbiWithOpenRefinementAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Typed schedule PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Refining, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = $"RT-{adoId}-001", Kind = ItemKind.Refinement, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Refine the PBI", Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" });
        await db.SaveChangesAsync();
    }

    private async Task SeedRepoAsync(string id, string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (await db.Repos.AnyAsync(repo => repo.Id == id))
            return;

        db.Repos.Add(new Repo { Id = id, AdoProject = "Proj", Name = name, RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });
        await db.SaveChangesAsync();
    }

    private async Task<LocalItem> LoadAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<bool> ExistsAsync(int scheduleId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().TaskSchedules.AnyAsync(row => row.Id == scheduleId);
    }

    private async Task<IReadOnlyList<CronEntry>> CronEntriesAsync()
    {
        var source = host.Host.Services.GetServices<ICronSource>().OfType<TaskScheduleCronSource>().Single();

        return await source.EntriesAsync(CancellationToken.None);
    }
}
