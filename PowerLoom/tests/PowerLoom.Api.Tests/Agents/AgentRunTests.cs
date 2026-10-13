using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Features.Agents.AgentRun;
using PowerLoom.Features.Agents.Completed.Models;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Features.Agents.Dispatch.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Agents;

[Collection(PowerLoomCollection.Name)]
public sealed class AgentRunTests(PowerLoomHost host)
{
    private const string Agent = "research";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Run_now_holds_a_waiting_task_starts_a_valid_one_and_the_callback_hands_it_on()
    {
        const int waiting = 62001;
        const int ready = 62002;
        var runner = host.Host.Services.GetRequiredService<FakeRunnerClient>();

        await SeedPbiAsync(waiting, withOpenQuestion: true);
        await SeedPbiAsync(ready, withOpenQuestion: false);
        runner.BusyAnswers = 1;

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new { }).ToUrl($"/api/agents/{Agent}/run");
            scenario.StatusCodeShouldBe(202);
        }));
        var held = await LoadTaskAsync($"AT-{waiting}-001");
        var started = await LoadTaskAsync($"AT-{ready}-001");

        Assert.Single(session.Executed.MessagesOf<DispatchAgent>());
        Assert.Equal((ItemStatus.Open, $"[\"Waiting for you: Q-{waiting}-001\"]"), (held.Status, held.HeldBy));
        Assert.Equal((ItemStatus.InProgress, "[]"), (started.Status, started.HeldBy));
        Assert.Equal(PipelineStatus.Researching, (await LoadPbiAsync(ready)).PipelineStatus);

        // Busy once, then accepted: the retry is a delayed message, polled from the database.
        await WaitUntilAsync(() => runner.Requests.Count(request => request.TaskId == started.Id) == 2);

        await EndTaskAsync(started.Id, ItemStatus.Done);

        var completed = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new CompletedRunRequest(null, RunOutcome.Success, null)).ToUrl($"/api/agent-runs/{started.Id}/completed");
            scenario.StatusCodeShouldBe(202);
        }));
        var ended = await LoadTaskAsync(started.Id);

        Assert.Single(completed.Executed.MessagesOf<AgentRunCompleted>());
        Assert.Single(completed.Executed.MessagesOf<PbiChanged>());
        Assert.NotNull(ended.HandedOnAt);
        // For any agent that handles design tasks, not one named agent (user decision 2026-10-13).
        Assert.Equal([$"DT-{ready}-001"], await OpenTaskIdsAsync(ready, AgentStages.AnyAgent));
        Assert.Equal(PipelineStatus.ReadyForDesign, (await LoadPbiAsync(ready)).PipelineStatus);
    }

    [Fact]
    public async Task A_run_without_a_callback_times_out_and_the_task_is_open_again()
    {
        const int adoId = 62003;
        var taskId = $"DT-{adoId}-001";

        await SeedPbiAsync(adoId, withOpenQuestion: false, withResearchTask: false);
        await SeedDesignTaskAsync(adoId, taskId);

        // The design agent's timeoutMinutes is 0: the test host's 2 s margin alone.
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new { }).ToUrl("/api/agents/design/run");
            scenario.StatusCodeShouldBe(202);
        }));

        var runId = await SeedRunningRunAsync(adoId, taskId);

        await WaitUntilAsync(async () => (await LoadTaskAsync(taskId)).Status == ItemStatus.Open);

        var task = await LoadTaskAsync(taskId);
        var run = await LoadRunAsync(runId);

        Assert.StartsWith("[\"Timed out: ", task.HeldBy);
        Assert.Equal(RunOutcome.Timeout, run.Outcome);
        Assert.NotNull(run.EndedAt);
    }

    [Fact]
    public async Task An_unknown_agent_is_refused_and_the_schedule_lists_the_enabled_ones()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new { }).ToUrl("/api/agents/nobody/run");
            scenario.StatusCodeShouldBe(404);
        });

        var entries = await CronEntriesAsync();

        Assert.Contains(entries, entry => entry.Key == $"agent:{Agent}" && entry.Cron == "*/15 * * * *" && entry.Message is DispatchAgent dispatch && dispatch.AgentId == Agent);
        Assert.DoesNotContain(entries, entry => entry.Key == "agent:vault-review");
    }

    private async Task SeedPbiAsync(int adoId, bool withOpenQuestion, bool withResearchTask = true)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.NeedsResearch, SyncedAt = DateTime.UtcNow });

        if (withResearchTask)
            db.LocalItems.Add(new LocalItem { Id = $"AT-{adoId}-001", Kind = ItemKind.Research, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Research the PBI", Status = ItemStatus.Open, Assignee = $"agent:{Agent}", HeldBy = "[]" });

        if (withOpenQuestion)
            db.LocalItems.Add(new LocalItem { Id = $"Q-{adoId}-001", Kind = ItemKind.Question, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Which tenant?", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private async Task SeedDesignTaskAsync(int adoId, string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem { Id = taskId, Kind = ItemKind.Design, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Design the implementation", Status = ItemStatus.Open, Assignee = "agent:design", HeldBy = "[]" });
        await db.SaveChangesAsync();
    }

    private async Task<long> SeedRunningRunAsync(int adoId, string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var run = new AgentRun { PbiId = adoId, ItemId = taskId, Stage = Stage.Design, Outcome = RunOutcome.Running };

        db.AgentRuns.Add(run);
        await db.SaveChangesAsync();

        return run.Id;
    }

    // What the runner does at the end of a run: the task's status is its to set.
    private async Task EndTaskAsync(string taskId, ItemStatus status)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.LocalItems.Where(item => item.Id == taskId).ExecuteUpdateAsync(set => set.SetProperty(item => item.Status, status));
    }

    private async Task<LocalItem> LoadTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<WorkItem> LoadPbiAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == adoId);
    }

    private async Task<AgentRun> LoadRunAsync(long id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().AgentRuns.AsNoTracking().SingleAsync(run => run.Id == id);
    }

    private async Task<List<string>> OpenTaskIdsAsync(int adoId, string assignee)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId && item.Assignee == assignee && item.Status == ItemStatus.Open).Select(item => item.Id).ToListAsync();
    }

    private async Task<List<CronEntry>> CronEntriesAsync()
    {
        var entries = new List<CronEntry>();

        foreach (var source in host.Host.Services.GetServices<ICronSource>())
            entries.AddRange(await source.EntriesAsync(CancellationToken.None));

        return entries;
    }

    private static Task WaitUntilAsync(Func<bool> condition) => WaitUntilAsync(() => Task.FromResult(condition()));

    private static async Task WaitUntilAsync(Func<Task<bool>> condition)
    {
        var deadline = DateTime.UtcNow + Timeout;

        while (!await condition() && DateTime.UtcNow < deadline)
            await Task.Delay(200);

        Assert.True(await condition(), "the condition was not met in time");
    }
}
