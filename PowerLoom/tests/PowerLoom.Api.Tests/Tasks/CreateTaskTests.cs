using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Tasks;

// Tasks the user creates (user decision 2026-10-14): a task type for any agent that takes it, the description as the
// body and the acceptance criteria as `doneWhen`.
[Collection(PowerLoomCollection.Name)]
public sealed class CreateTaskTests(PowerLoomHost host)
{
    private const int AdoId = 64714;
    private const string Criteria = "Names the cause, with evidence";

    [Fact]
    public async Task Research_without_a_PBI_is_a_goal_for_any_research_agent_on_the_chosen_repos()
    {
        await SeedRepoAsync("r-create", "CreateRepo");

        var refused = await PostAsync(Request("research", repos: ["Nope"]), 400);
        var created = await host.Host.PostJson(Request("research", repos: ["CreateRepo"]), "/api/tasks").Receive<CreatedTask>();
        var task = await LoadAsync(created!.Id);
        var data = JsonDocument.Parse(task.Data!).RootElement;

        Assert.Contains("Not among the vault's enabled repositories: Nope.", refused);
        Assert.StartsWith("GT-", task.Id);
        Assert.Equal((ItemKind.Research, "agent:*", "Find out why", ItemStatus.Open, (int?)null), (task.Kind, task.Assignee, task.Body, task.Status, task.PbiId));
        Assert.Equal(("user", Criteria, Criteria), (data.GetProperty("createdBy").GetString(), data.GetProperty("doneWhen").GetString(), data.GetProperty("goal").GetString()));
        Assert.Equal(["CreateRepo"], data.GetProperty("repos").EnumerateArray().Select(repo => repo.GetString()!));
    }

    [Fact]
    public async Task Refinement_needs_a_PBI_of_the_vault_and_only_one_waits_at_a_time()
    {
        await SeedPbiAsync();

        var withoutPbi = await PostAsync(Request("refinement"), 400);
        var unknownPbi = await PostAsync(Request("refinement", pbi: "999999"), 404);
        var created = await host.Host.PostJson(Request("refinement", pbi: $"#{AdoId}"), "/api/tasks").Receive<CreatedTask>();
        var second = await PostAsync(Request("refinement", pbi: AdoId.ToString()), 409);
        var task = await LoadAsync(created!.Id);

        Assert.Contains("A refinement task needs a PBI.", withoutPbi);
        Assert.Contains("PBI-999999 isn't in test-vault.", unknownPbi);
        Assert.Equal(($"RT-{AdoId}-001", AdoId), (created.Id, created.PbiId));
        Assert.Equal((ItemKind.Refinement, "agent:*", (int?)AdoId), (task.Kind, task.Assignee, task.PbiId));
        Assert.Contains($"RT-{AdoId}-001 is still open on PBI-{AdoId}.", second);
    }

    [Fact]
    public async Task A_docs_task_names_no_note_and_takes_no_PBI()
    {
        var withPbi = await PostAsync(Request("docs", pbi: AdoId.ToString()), 400);
        var created = await host.Host.PostJson(Request("docs"), "/api/tasks").Receive<CreatedTask>();
        var task = await LoadAsync(created!.Id);
        var data = JsonDocument.Parse(task.Data!).RootElement;

        Assert.Contains("A docs task takes no PBI.", withPbi);
        Assert.StartsWith("WT-", task.Id);
        Assert.Equal((ItemKind.Docs, "agent:*", "Find out why"), (task.Kind, task.Assignee, task.Body));
        Assert.Equal(("request", PowerLoomHost.Vault, Criteria), (data.GetProperty("mode").GetString(), data.GetProperty("vault").GetString(), data.GetProperty("doneWhen").GetString()));
        Assert.False(data.TryGetProperty("path", out _));
    }

    [Fact]
    public async Task An_unknown_type_or_missing_acceptance_criteria_is_refused()
    {
        var unknownType = await PostAsync(Request("deploy"), 400);
        var noCriteria = await PostAsync(Request("research") with { AcceptanceCriteria = " " }, 400);

        Assert.Contains("Unknown task type deploy; one of: refinement, research, design, docs.", unknownType);
        Assert.Contains("Acceptance criteria: 1 to 4000 characters required.", noCriteria);
    }

    private static CreateTaskRequest Request(string type, string? pbi = null, List<string>? repos = null)
    {
        return new CreateTaskRequest(PowerLoomHost.Vault, type, "Why it fails", "Find out why", Criteria, pbi, repos, null);
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

    private async Task SeedRepoAsync(string id, string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.Repos.Add(new Repo { Id = id, AdoProject = "Proj", Name = name, RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });
        await db.SaveChangesAsync();
    }

    private async Task SeedPbiAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Create task PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    private async Task<LocalItem> LoadAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }
}
