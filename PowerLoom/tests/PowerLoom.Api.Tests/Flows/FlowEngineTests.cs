using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Features.Agents.AgentRun;
using PowerLoom.Features.Agents.Completed.Models;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Features.Flows.Engine;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Features.Tasks.CloseItem.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Flows;

// PowerLoom Flow phase 2: the engine that turns an execution into tasks (FlowAdvancer). The planner is the one enabled
// agent, with a task type of its own, so the dispatcher claims its flow task and the run saga carries the callback; the
// other agents are disabled, so their tasks stay open for the engine's own checks.
[Collection(PowerLoomCollection.Name)]
public sealed class FlowEngineTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string Planner = "flow-engine-planner";
    private const string Builder = "flow-engine-builder";
    private const string Refiner = "flow-engine-refiner";
    private const string Planning = "flow-planning";
    private const string Building = "flow-building";
    private const string Reviewing = "flow-review";
    private const int AdoId = 70411;
    private const string TargetTask = "FT-70411-001";
    private const string OpenRefinement = "RT-70411-001";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    public Task InitializeAsync() => SeedAsync();

    public async Task DisposeAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.ExecuteSqlAsync($"DELETE FROM agent_config.agent WHERE id IN ({Planner}, {Builder}, {Refiner})");
    }

    [Fact]
    public async Task A_run_creates_the_first_task_pinned_to_its_agent_and_the_runner_callback_creates_the_next_one_with_a_hand_off()
    {
        var flow = await SaveFlowAsync("Engine flow", Linear(Planner));
        var (execution, run) = await RunAsync(flow.Id, PbiTarget());
        var plan = Assert.Single(await TasksOfAsync(execution.Id));
        var data = JsonDocument.Parse(plan.Data!).RootElement;

        // The first node's task: pinned, marked, numbered on the PBI; the dispatcher claimed it right away.
        Assert.Equal(("running", 1), (execution.Status, execution.FlowVersion));
        Assert.StartsWith($"XT-{AdoId}-", plan.Id);
        Assert.Equal(($"agent:{Planner}", Planning, AdoId, (string?)null, $"Plan PBI-{AdoId}"), (plan.Assignee, plan.Kind, plan.PbiId, plan.ParentId, plan.Title));
        Assert.Equal((execution.Id, "plan", flow.Id, 1, $"{execution.Id}:plan", $"Plan PBI-{AdoId}", 0, "flow"), (Text(data, "flowExecutionId"), Text(data, "flowNodeId"), Text(data, "flowId"), data.GetProperty("flowVersion").GetInt32(), Text(data, "key"), Text(data, "goal"), data.GetProperty("depth").GetInt32(), Text(data, "createdBy")));
        Assert.Empty(data.GetProperty("dependsOn").EnumerateArray());
        Assert.Null(plan.CreatedByRun);
        Assert.Contains(run.Executed.MessagesOf<DispatchAgent>(), message => message.AgentId == Planner);
        Assert.Contains(host.Host.Services.GetRequiredService<Probes.FakeRunnerClient>().Requests, request => request.TaskId == plan.Id);
        // The run's answer lists the steps (the dispatch races the answer, so the task's status is read afterwards).
        Assert.Equal([("plan", plan.Id), ("build", null), ("review", null)], execution.Steps.Select(step => (step.NodeId, step.ItemId)));
        Assert.Equal([("plan", plan.Id, "in-progress", 0, Planner, Planning), ("build", null, "pending", 0, Builder, Building), ("review", null, "pending", 0, Builder, Reviewing)], Shaped(await StepsAsync(execution.Id)));

        // The runner ends the task and calls back: the saga's hook creates the next node's task with the hand-off.
        var runId = await EndTaskAsync(plan.Id, ItemStatus.Done, Planner);
        var completed = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new CompletedRunRequest(runId, RunOutcome.Success, null)).ToUrl($"/api/agent-runs/{plan.Id}/completed");
            scenario.StatusCodeShouldBe(202);
        }));
        var build = Assert.Single(await TasksOfAsync(execution.Id), task => task.Id != plan.Id);
        var handoff = Assert.Single(await HandoffsIntoAsync(build.Id));

        Assert.Single(completed.Executed.MessagesOf<AgentRunCompleted>());
        Assert.Contains(completed.Executed.MessagesOf<DispatchAgent>(), message => message.AgentId == Builder);
        Assert.Equal(($"agent:{Builder}", Building, ItemStatus.Open, $"{Building} for Engine flow"), (build.Assignee, build.Kind, build.Status, build.Title));
        Assert.Equal([plan.Id], JsonDocument.Parse(build.Data!).RootElement.GetProperty("dependsOn").EnumerateArray().Select(value => value.GetString()));
        Assert.Equal((plan.Id, Planner, runId, "agent", "continue", "none", "open"), (handoff.FromTaskId, handoff.FromAgent, handoff.FromRunId, handoff.ToKind, handoff.Intent, handoff.Gate, handoff.Status));
        Assert.Equal($"Engine flow → {Building} for Engine flow: continue with the result of Plan PBI-{AdoId}", handoff.Body);
        // jsonb orders keys by length, then name.
        Assert.Equal($$"""{"items": ["{{plan.Id}}"], "notes": [], "results": ["RUN-{{runId}}"]}""", handoff.Refs);
        Assert.Equal([("plan", plan.Id, "done", 1, Planner, Planning), ("build", build.Id, "open", 0, Builder, Building), ("review", null, "pending", 0, Builder, Reviewing)], Shaped(await StepsAsync(execution.Id)));

        // The last required node done: the execution is done; the optional-only review was never created (skipped).
        await EndTaskAsync(build.Id, ItemStatus.Done, Builder);
        await AdvanceAsync(execution.Id);

        var finished = await LoadExecutionAsync(execution.Id);

        Assert.Equal(("done", (string?)null), (finished.Status, finished.Error));
        Assert.NotNull(finished.FinishedAt);
        Assert.Equal([("plan", plan.Id, "done", 1, Planner, Planning), ("build", build.Id, "done", 1, Builder, Building), ("review", null, "skipped", 0, Builder, Reviewing)], Shaped(await StepsAsync(execution.Id)));
        Assert.Equal(2, (await TasksOfAsync(execution.Id)).Count);
    }

    [Fact]
    public async Task Fan_in_waits_for_both_required_predecessors_and_advancing_twice_creates_nothing_twice()
    {
        var flow = await SaveFlowAsync("Fan in", FanIn());
        var (execution, _) = await RunAsync(flow.Id, TaskTarget());
        var started = await TasksOfAsync(execution.Id);
        var a = Assert.Single(started, task => NodeOf(task) == "a");
        var b = Assert.Single(started, task => NodeOf(task) == "b");

        // A flow run for a task: its tasks are the target's children on the target's PBI.
        Assert.Equal(2, started.Count);
        Assert.All(started, task => Assert.Equal((TargetTask, AdoId, ItemStatus.Open), (task.ParentId, task.PbiId, task.Status)));
        Assert.Equal($"{Building} for Fan in", a.Title);

        await EndTaskAsync(a.Id, ItemStatus.Done, Builder);
        await Task.WhenAll(AdvanceAsync(execution.Id), AdvanceAsync(execution.Id));

        Assert.Equal(2, (await TasksOfAsync(execution.Id)).Count);

        await EndTaskAsync(b.Id, ItemStatus.Done, Builder);
        await Task.WhenAll(AdvanceAsync(execution.Id), AdvanceAsync(execution.Id));

        var c = Assert.Single(await TasksOfAsync(execution.Id), task => NodeOf(task) == "c");
        var handoffs = await HandoffsIntoAsync(c.Id);

        Assert.Equal(3, (await TasksOfAsync(execution.Id)).Count);
        Assert.Equal([a.Id, b.Id], JsonDocument.Parse(c.Data!).RootElement.GetProperty("dependsOn").EnumerateArray().Select(value => value.GetString()));
        Assert.Equal([a.Id, b.Id], handoffs.Select(handoff => handoff.FromTaskId).Order());
        Assert.Equal("running", (await LoadExecutionAsync(execution.Id)).Status);

        await host.Host.PostJson(new { }, $"/api/flow-executions/{execution.Id}/cancel").Receive<FlowExecutionView>();
    }

    [Fact]
    public async Task A_cancelled_predecessor_fails_the_execution_and_a_cancel_cancels_the_waiting_tasks()
    {
        var flow = await SaveFlowAsync("Cancel me", Linear(Builder));
        var (failing, _) = await RunAsync(flow.Id, PbiTarget());
        var (cancelling, _) = await RunAsync(flow.Id, PbiTarget());
        var first = Assert.Single(await TasksOfAsync(failing.Id));

        // A person cancels the first node's task: the close endpoint's hook fails the execution; nothing follows.
        await host.Host.PostJson(new CloseRequest(AdoId, CloseDecision.Cancel, null, false), $"/api/items/{first.Id}/close").Receive<ClosedItem>();

        var failed = await LoadExecutionAsync(failing.Id);

        Assert.Equal("failed", failed.Status);
        Assert.Equal($"Step \"Plan PBI-{AdoId}\" ({first.Id}) was cancelled.", failed.Error);
        Assert.NotNull(failed.FinishedAt);
        Assert.Single(await TasksOfAsync(failing.Id));
        Assert.Equal([("plan", first.Id, "cancelled", 0, Builder, Planning), ("build", null, "skipped", 0, Builder, Building), ("review", null, "skipped", 0, Builder, Reviewing)], Shaped(await StepsAsync(failing.Id)));

        // The user cancels the other execution: its waiting agent task is cancelled as a person would.
        var waiting = Assert.Single(await TasksOfAsync(cancelling.Id));
        var cancelled = await host.Host.PostJson(new { }, $"/api/flow-executions/{cancelling.Id}/cancel").Receive<FlowExecutionView>();
        var task = await LoadTaskAsync(waiting.Id);

        Assert.Equal("cancelled", cancelled!.Status);
        Assert.Equal([("plan", waiting.Id, "cancelled", 0, Builder, Planning), ("build", null, "skipped", 0, Builder, Building), ("review", null, "skipped", 0, Builder, Reviewing)], Shaped(cancelled.Steps));
        Assert.Equal(ItemStatus.Cancelled, task.Status);
        Assert.NotNull(task.ClosedAt);
        Assert.Equal("human", await LastStatusActorAsync(waiting.Id));
        // Nothing happens to a finished execution: an advance leaves it alone.
        Assert.Equal("cancelled", (await AdvanceAsync(cancelling.Id)).Status);
    }

    [Fact]
    public async Task One_per_PBI_does_not_block_a_flow_refinement_task()
    {
        var flow = await SaveFlowAsync("Refine again", new FlowDefinitionInput([Trigger(), Agent("refine", Refiner, ItemKinds.Refinement, "Refine {pbi} again")], [Edge("e1", "trigger", "refine")]));
        var (execution, _) = await RunAsync(flow.Id, PbiTarget());
        var refinement = Assert.Single(await TasksOfAsync(execution.Id));

        Assert.Equal(ItemStatus.Open, (await LoadTaskAsync(OpenRefinement)).Status);
        Assert.StartsWith($"RT-{AdoId}-", refinement.Id);
        Assert.NotEqual(OpenRefinement, refinement.Id);
        Assert.Equal(($"agent:{Refiner}", ItemKinds.Refinement, $"Refine PBI-{AdoId} again"), (refinement.Assignee, refinement.Kind, refinement.Title));

        await host.Host.PostJson(new { }, $"/api/flow-executions/{execution.Id}/cancel").Receive<FlowExecutionView>();
    }

    [Fact]
    public async Task The_ticker_lists_every_running_execution_and_its_message_advances_one_the_runner_closed_itself()
    {
        var flow = await SaveFlowAsync("Ticked", Linear(Builder));
        var (execution, _) = await RunAsync(flow.Id, PbiTarget());
        var plan = Assert.Single(await TasksOfAsync(execution.Id));
        var entries = await CronEntriesAsync();

        Assert.Contains(entries, entry => entry.Key == $"flow:{execution.Id}" && entry.Cron == FlowCronSource.Cron && entry.Message is AdvanceFlowExecution advance && advance.ExecutionId == execution.Id);

        // The runner closed the task straight in the database (no callback reached a hook): the tick's advance finds it.
        await EndTaskAsync(plan.Id, ItemStatus.Done, Builder);

        using (var scope = host.Host.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IMessageBus>().InvokeAsync(new AdvanceFlowExecution(execution.Id));

        var build = Assert.Single(await TasksOfAsync(execution.Id), task => NodeOf(task) == "build");

        Assert.Equal(ItemStatus.Open, build.Status);

        await host.Host.PostJson(new { }, $"/api/flow-executions/{execution.Id}/cancel").Receive<FlowExecutionView>();

        Assert.DoesNotContain(await CronEntriesAsync(), entry => entry.Key == $"flow:{execution.Id}");
    }

    // trigger → plan (required) → build (required) → review (optional).
    private static FlowDefinitionInput Linear(string planner)
    {
        return new FlowDefinitionInput(
            [Trigger(), Agent("plan", planner, Planning, "Plan {target}"), Agent("build", Builder, Building), Agent("review", Builder, Reviewing)],
            [Edge("e1", "trigger", "plan"), Edge("e2", "plan", "build"), Edge("e3", "build", "review", "optional")]);
    }

    // trigger → a, trigger → b, a → c, b → c (all required).
    private static FlowDefinitionInput FanIn()
    {
        return new FlowDefinitionInput(
            [Trigger(), Agent("a", Builder, Building), Agent("b", Builder, Building), Agent("c", Builder, Reviewing)],
            [Edge("e1", "trigger", "a"), Edge("e2", "trigger", "b"), Edge("e3", "a", "c"), Edge("e4", "b", "c")]);
    }

    private static FlowNodeInput Trigger() => new("trigger", "trigger", null, null, null, null, new FlowPosition(40, 160));

    private static FlowNodeInput Agent(string id, string agent, string kind, string title = "{kind} for {flow}") => new(id, "agent", agent, kind, title, 1, new FlowPosition(320, 80));

    private static FlowEdgeInput Edge(string id, string from, string to, string kind = "required") => new(id, from, to, kind);

    private static RunFlowInput PbiTarget() => new(PowerLoomHost.Vault, new FlowTargetInput("pbi", AdoId, null));

    private static RunFlowInput TaskTarget() => new(PowerLoomHost.Vault, new FlowTargetInput("task", null, TargetTask));

    private static string? Text(JsonElement element, string name) => element.GetProperty(name).GetString();

    private static string? NodeOf(LocalItem task) => FlowTaskData.NodeIdOf(task.Data);

    private static List<(string, string?, string, int, string, string)> Shaped(IEnumerable<FlowStepView> steps) => steps.Select(step => (step.NodeId, step.ItemId, step.Status, step.Runs, step.Agent, step.Kind)).ToList();

    private async Task<SavedFlow> SaveFlowAsync(string name, FlowDefinitionInput definition)
    {
        return (await host.Host.PutJson(new FlowInput(null, PowerLoomHost.Vault, name, definition), "/api/flows").Receive<SavedFlow>())!;
    }

    // The run and everything it set off (the dispatch, the claim, the runner's start), tracked.
    private async Task<(FlowExecutionView Execution, ITrackedSession Session)> RunAsync(string flowId, RunFlowInput input)
    {
        FlowExecutionView? execution = null;
        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => execution = await host.Host.PostJson(input, $"/api/flows/{flowId}/run").Receive<FlowExecutionView>()));

        return (execution!, session);
    }

    private async Task<FlowAdvanceResult> AdvanceAsync(string executionId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<FlowAdvancer>().AdvanceAsync(executionId, CancellationToken.None);
    }

    private async Task<List<FlowStepView>> StepsAsync(string executionId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var execution = await db.FlowExecutions.AsNoTracking().SingleAsync(row => row.Id == executionId);

        return await FlowSteps.ComputeAsync(db, execution, CancellationToken.None);
    }

    // What the runner does at the end of a run: a run row with its outcome, and the task's status.
    private async Task<long> EndTaskAsync(string taskId, ItemStatus status, string agent)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var run = new AgentRun { PbiId = AdoId, ItemId = taskId, Stage = agent, Outcome = RunOutcome.Success, EndedAt = DateTime.UtcNow };

        db.AgentRuns.Add(run);
        await db.SaveChangesAsync();
        await db.LocalItems.Where(item => item.Id == taskId).ExecuteUpdateAsync(set => set.SetProperty(item => item.Status, status));

        return run.Id;
    }

    private async Task<List<LocalItem>> TasksOfAsync(string executionId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await FlowExecutionTasks.LoadAllAsync(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), executionId, CancellationToken.None);
    }

    private async Task<List<HandoffRow>> HandoffsIntoAsync(string itemId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database
            .SqlQuery<HandoffRow>($"""select from_task_id as "FromTaskId", from_agent as "FromAgent", from_run_id as "FromRunId", to_kind as "ToKind", intent as "Intent", gate as "Gate", body as "Body", refs::text as "Refs", status as "Status" from handoff where to_item_id = {itemId} order by id""")
            .ToListAsync();
    }

    private async Task<string?> LastStatusActorAsync(string itemId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().StatusHistories.AsNoTracking().Where(row => row.EntityId == itemId).OrderByDescending(row => row.Id).Select(row => row.Actor).FirstOrDefaultAsync();
    }

    private async Task<FlowExecution> LoadExecutionAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().FlowExecutions.AsNoTracking().SingleAsync(row => row.Id == id);
    }

    private async Task<LocalItem> LoadTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<List<CronEntry>> CronEntriesAsync()
    {
        var entries = new List<CronEntry>();

        foreach (var source in host.Host.Services.GetServices<ICronSource>())
            entries.AddRange(await source.EntriesAsync(CancellationToken.None));

        return entries;
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await SeedAgentAsync(db, Planner, enabled: true, [Planning]);
        await SeedAgentAsync(db, Builder, enabled: false, [Planning, Building, Reviewing]);
        await SeedAgentAsync(db, Refiner, enabled: false, [ItemKinds.Refinement]);

        if (!await db.WorkItems.AnyAsync(row => row.AdoId == AdoId))
            db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Flow engine PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });

        if (!await db.LocalItems.AnyAsync(row => row.Id == TargetTask))
            db.LocalItems.Add(new LocalItem { Id = TargetTask, Kind = "planning", PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "The target task", Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" });

        // An open refinement task on the PBI: the Tasks page's one-per-PBI rule would refuse a second one.
        if (!await db.LocalItems.AnyAsync(row => row.Id == OpenRefinement))
            db.LocalItems.Add(new LocalItem { Id = OpenRefinement, Kind = ItemKinds.Refinement, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Refine the PBI", Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    // No schedule: the planner runs only when the engine dispatches it.
    private static Task SeedAgentAsync(PowerLoomDbContext db, string id, bool enabled, string[] handles)
    {
        var definition = JsonSerializer.Serialize(new { id, label = id, enabled, handles, waitFor = Array.Empty<string>(), limits = new { timeoutMinutes = 1 } });

        return db.Database.ExecuteSqlAsync($"INSERT INTO agent_config.agent (id, definition) VALUES ({id}, {definition}::jsonb) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition");
    }

    private sealed class HandoffRow
    {
        public string FromTaskId { get; set; } = "";

        public string FromAgent { get; set; } = "";

        public long? FromRunId { get; set; }

        public string ToKind { get; set; } = "";

        public string Intent { get; set; } = "";

        public string Gate { get; set; } = "";

        public string Body { get; set; } = "";

        public string Refs { get; set; } = "";

        public string Status { get; set; } = "";
    }
}
