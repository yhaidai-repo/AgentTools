using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Flows;

// PowerLoom Flow phase 1: the flow aggregate without the engine (the design note powerloom-flow-design, 2026-11-03).
[Collection(PowerLoomCollection.Name)]
public sealed class FlowsTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string Planner = "flow-planner";
    private const string Builder = "flow-builder";
    private const int AdoId = 70311;
    private const string TaskId = "FT-70311-001";

    public Task InitializeAsync() => SeedAsync();

    // The seeded agents would show up in every other test's list of handled task types.
    public async Task DisposeAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.ExecuteSqlAsync($"DELETE FROM agent_config.agent WHERE id IN ({Planner}, {Builder})");
    }

    [Fact]
    public async Task A_flow_is_saved_with_its_definition_and_every_change_bumps_its_version()
    {
        var created = await host.Host.PutJson(Input(null, "Plan then build"), "/api/flows").Receive<SavedFlow>();
        var changed = await host.Host.PutJson(Input(created!.Id, "Plan then build again", TwoSteps(optionalReview: true)), "/api/flows").Receive<SavedFlow>();
        var row = await LoadFlowAsync(created.Id);

        Assert.StartsWith("FL-", created.Id);
        Assert.Equal((PowerLoomHost.Vault, "Plan then build", 1), (created.Vault, created.Name, created.Version));
        Assert.Equal(["trigger", "plan", "build"], created.Definition.Nodes.Select(node => node.Id));
        Assert.Equal((created.Id, "Plan then build again", 2), (changed!.Id, changed.Name, changed.Version));
        Assert.Equal(["required", "required", "optional"], changed.Definition.Edges.Select(edge => edge.Kind));
        Assert.Equal(2, row.Version);
        // Stored as the TypeScript schema reads it: camelCase, the trigger node without null agent fields (jsonb spaces its pairs).
        Assert.Contains("\"type\": \"agent\"", row.Definition);
        Assert.DoesNotContain("\"agent\": null", row.Definition);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/flows/{created.Id}");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.False(await FlowExistsAsync(created.Id));
    }

    [Fact]
    public async Task A_definition_is_refused_for_a_dangling_edge_a_required_cycle_a_kind_the_agent_does_not_handle_and_an_unknown_agent()
    {
        var dangling = TwoSteps() with { Edges = [Edge("e1", "trigger", "plan"), Edge("e2", "plan", "nowhere")] };
        var cycle = TwoSteps() with { Edges = [Edge("e1", "trigger", "plan"), Edge("e2", "plan", "build"), Edge("e3", "build", "plan")] };
        var optionalCycle = TwoSteps() with { Edges = [Edge("e1", "trigger", "plan"), Edge("e2", "plan", "build"), Edge("e3", "build", "plan", "optional")] };
        var wrongKind = TwoSteps() with { Nodes = [Trigger(), Agent("plan", Planner, "planning"), Agent("build", Builder, "planning")] };
        var unknownAgent = TwoSteps() with { Nodes = [Trigger(), Agent("plan", Planner, "planning"), Agent("build", "nobody", "implementation")] };
        var twoTriggers = TwoSteps() with { Nodes = [Trigger(), Agent("plan", Planner, "planning"), Agent("build", Builder, "implementation"), new FlowNodeInput("trigger", "trigger", null, null, null, null, new FlowPosition(0, 0))] };

        Assert.Contains("goes from \"plan\" to \"nowhere\", but there is no such node", await RefusedAsync(Input(null, "Dangling", dangling), 400));
        Assert.Contains("Required edges form a cycle through", await RefusedAsync(Input(null, "Cycle", cycle), 400));
        Assert.Contains("agent \"flow-builder\" doesn't handle \"planning\" (it handles: implementation, review)", await RefusedAsync(Input(null, "Wrong kind", wrongKind), 400));
        Assert.Contains("agent \"nobody\" is not configured", await RefusedAsync(Input(null, "Unknown agent", unknownAgent), 400));
        Assert.Contains("Node id \"trigger\" is used twice", await RefusedAsync(Input(null, "Two triggers", twoTriggers), 400));
        Assert.Contains("isn't a vault", await RefusedAsync(Input(null, "No vault", TwoSteps()) with { Vault = "no-such-vault" }, 404));

        var allowed = await host.Host.PutJson(Input(null, "Optional loop", optionalCycle), "/api/flows").Receive<SavedFlow>();
        var sameName = await RefusedAsync(Input(null, "Optional loop", TwoSteps()), 409);

        Assert.Contains("already has a flow named \"Optional loop\"", sameName);
        await DeleteAsync(allowed!.Id);
    }

    [Fact]
    public async Task A_run_needs_a_target_of_the_vault_and_records_an_execution_the_user_can_cancel()
    {
        var flow = await host.Host.PutJson(Input(null, "Run me"), "/api/flows").Receive<SavedFlow>();

        Assert.Contains("PBI 1 isn't in vault test-vault", await RefusedAsync(new RunFlowInput(PowerLoomHost.Vault, new FlowTargetInput("pbi", 1, null)), $"/api/flows/{flow!.Id}/run", 404));
        Assert.Contains("Task NOPE-1 isn't in vault test-vault", await RefusedAsync(new RunFlowInput(PowerLoomHost.Vault, new FlowTargetInput("task", null, "NOPE-1")), $"/api/flows/{flow.Id}/run", 404));
        Assert.Contains("Target kind \"pr\" isn't", await RefusedAsync(new RunFlowInput(PowerLoomHost.Vault, new FlowTargetInput("pr", null, null)), $"/api/flows/{flow.Id}/run", 400));
        Assert.Contains("isn't in vault other-vault", await RefusedAsync(new RunFlowInput("other-vault", new FlowTargetInput("pbi", AdoId, null)), $"/api/flows/{flow.Id}/run", 404));

        var forPbi = await host.Host.PostJson(new RunFlowInput(PowerLoomHost.Vault, new FlowTargetInput("pbi", AdoId, null)), $"/api/flows/{flow.Id}/run").Receive<FlowExecutionView>();
        var forTask = await host.Host.PostJson(new RunFlowInput(PowerLoomHost.Vault, new FlowTargetInput("task", null, TaskId)), $"/api/flows/{flow.Id}/run").Receive<FlowExecutionView>();

        Assert.StartsWith("FX-", forPbi!.Id);
        Assert.Equal((flow.Id, 1, PowerLoomHost.Vault, "pbi", AdoId, (string?)null, "running"), (forPbi.FlowId, forPbi.FlowVersion, forPbi.Vault, forPbi.TargetKind, forPbi.PbiId, forPbi.ItemId, forPbi.Status));
        Assert.Equal(("task", (int?)null, TaskId), (forTask!.TargetKind, forTask.PbiId, forTask.ItemId));
        Assert.Equal(["trigger", "plan", "build"], forTask.Definition.Nodes.Select(node => node.Id));
        Assert.Null(forPbi.FinishedAt);

        // A running execution keeps its flow; a change of the flow doesn't reach it (the snapshot stays at version 1).
        Assert.Contains("has a running execution", await RefusedDeleteAsync(flow.Id, 409));
        await host.Host.PutJson(Input(flow.Id, "Run me v2"), "/api/flows").Receive<SavedFlow>();

        var cancelled = await host.Host.PostJson(new { }, $"/api/flow-executions/{forPbi.Id}/cancel").Receive<FlowExecutionView>();

        Assert.Equal(("cancelled", 1), (cancelled!.Status, cancelled.FlowVersion));
        Assert.NotNull(cancelled.FinishedAt);
        Assert.Contains($"Execution {forPbi.Id} is already cancelled", await RefusedAsync(new { }, $"/api/flow-executions/{forPbi.Id}/cancel", 409));
        Assert.Contains("doesn't exist", await RefusedAsync(new { }, "/api/flow-executions/FX-nope/cancel", 404));

        await host.Host.PostJson(new { }, $"/api/flow-executions/{forTask.Id}/cancel").Receive<FlowExecutionView>();
        await DeleteAsync(flow.Id);

        Assert.False(await ExecutionExistsAsync(forPbi.Id));
    }

    private static FlowInput Input(string? id, string name, FlowDefinitionInput? definition = null) => new(id, PowerLoomHost.Vault, name, definition ?? TwoSteps());

    // trigger → plan (required) → build (required), and build → plan (optional) when asked.
    private static FlowDefinitionInput TwoSteps(bool optionalReview = false)
    {
        List<FlowEdgeInput> edges = [Edge("e1", "trigger", "plan"), Edge("e2", "plan", "build")];

        if (optionalReview)
            edges.Add(Edge("e3", "build", "plan", "optional"));

        return new FlowDefinitionInput([Trigger(), Agent("plan", Planner, "planning"), Agent("build", Builder, "implementation")], edges);
    }

    private static FlowNodeInput Trigger() => new("trigger", "trigger", null, null, null, null, new FlowPosition(40, 160));

    private static FlowNodeInput Agent(string id, string agent, string kind) => new(id, "agent", agent, kind, "{kind} for {flow}", 1, new FlowPosition(320, 80));

    private static FlowEdgeInput Edge(string id, string from, string to, string kind = "required") => new(id, from, to, kind);

    private Task<string> RefusedAsync(FlowInput input, int status) => RefusedAsync(input, "/api/flows", status, put: true);

    private async Task<string> RefusedAsync(object input, string url, int status, bool put = false)
    {
        var result = await host.Host.Scenario(scenario =>
        {
            if (put)
                scenario.Put.Json(input).ToUrl(url);
            else
                scenario.Post.Json(input).ToUrl(url);
            scenario.StatusCodeShouldBe(status);
        });

        return await DetailOfAsync(result);
    }

    private async Task<string> RefusedDeleteAsync(string id, int status)
    {
        var result = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/flows/{id}");
            scenario.StatusCodeShouldBe(status);
        });

        return await DetailOfAsync(result);
    }

    // The problem's detail as written (the raw body escapes the quotes around ids).
    private static async Task<string> DetailOfAsync(IScenarioResult result)
    {
        using var problem = JsonDocument.Parse(await result.ReadAsTextAsync());

        return problem.RootElement.GetProperty("detail").GetString() ?? "";
    }

    private Task DeleteAsync(string id)
    {
        return host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/flows/{id}");
            scenario.StatusCodeShouldBeOk();
        });
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await SeedAgentAsync(db, Planner, ["planning"]);
        await SeedAgentAsync(db, Builder, ["implementation", "review"]);

        if (!await db.WorkItems.AnyAsync(row => row.AdoId == AdoId))
            db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Flow PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });

        if (!await db.LocalItems.AnyAsync(row => row.Id == TaskId))
            db.LocalItems.Add(new LocalItem { Id = TaskId, Kind = "planning", PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Plan the flow PBI", Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private static Task SeedAgentAsync(PowerLoomDbContext db, string id, string[] handles)
    {
        var definition = JsonSerializer.Serialize(new { id, label = id, enabled = false, handles });

        return db.Database.ExecuteSqlAsync($"INSERT INTO agent_config.agent (id, definition) VALUES ({id}, {definition}::jsonb) ON CONFLICT (id) DO UPDATE SET definition = excluded.definition");
    }

    private async Task<Flow> LoadFlowAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Flows.AsNoTracking().SingleAsync(flow => flow.Id == id);
    }

    private async Task<bool> FlowExistsAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Flows.AnyAsync(flow => flow.Id == id);
    }

    private async Task<bool> ExecutionExistsAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().FlowExecutions.AnyAsync(execution => execution.Id == id);
    }
}
