using System.Text.Json;
using PowerLoom.Features.Tasks.TaskNotes.Models;
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
    private const int NotesAdoId = 64715;
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

    // A test task (Autotest, design 2026-10-20) needs a PBI but has no pipeline stage: numbered per PBI as TT.
    [Fact]
    public async Task A_test_task_needs_a_PBI_and_is_numbered_per_PBI()
    {
        var withoutPbi = await PostAsync(Request("test"), 400);
        var created = await host.Host.PostJson(Request("test", pbi: AdoId.ToString()), "/api/tasks").Receive<CreatedTask>();
        var task = await LoadAsync(created!.Id);

        Assert.Contains("A test task needs a PBI.", withoutPbi);
        Assert.Equal($"TT-{AdoId}-001", task.Id);
        Assert.Equal((ItemKind.Test, "agent:*", AdoId), (task.Kind, task.Assignee, task.PbiId));
    }

    // A test task's own notes (user decision 2026-10-21): kept in its data, refused when they changed meanwhile.
    [Fact]
    public async Task A_test_task_keeps_the_users_notes_and_refuses_a_stale_save()
    {
        await SeedPbiAsync(NotesAdoId);

        var created = await host.Host.PostJson(Request("test", pbi: NotesAdoId.ToString()), "/api/tasks").Receive<CreatedTask>();
        var path = $"/api/items/{created!.Id}/user-notes";

        var saved = await host.Host.PutJson(new SaveTaskNotesRequest(" Use request 1190908. ", ""), path).Receive<TaskUserNotes>();
        var stale = await PutAsync(path, new SaveTaskNotesRequest("Something else", ""), 409);
        var task = await LoadAsync(created.Id);
        var data = JsonDocument.Parse(task.Data!).RootElement;

        Assert.Equal("Use request 1190908.", saved!.Text);
        Assert.Contains("The notes changed since this page loaded", stale);
        Assert.Equal("Use request 1190908.", data.GetProperty("userNotes").GetString());
        Assert.Equal(Criteria, data.GetProperty("doneWhen").GetString());
    }

    // The vault review is a task type (user decision 2026-10-18): it reviews the task's vault.
    [Fact]
    public async Task A_vault_review_task_reviews_its_vault_and_takes_no_PBI()
    {
        var withPbi = await PostAsync(Request("vault-review", pbi: AdoId.ToString()), 400);
        var created = await host.Host.PostJson(Request("vault-review"), "/api/tasks").Receive<CreatedTask>();
        var task = await LoadAsync(created!.Id);

        Assert.Contains("A vault-review task takes no PBI.", withPbi);
        Assert.StartsWith("VR-", task.Id);
        Assert.Equal((ItemKind.VaultReview, "agent:*", PowerLoomHost.Vault, (int?)null), (task.Kind, task.Assignee, task.Vault, task.PbiId));
    }

    [Fact]
    public async Task An_unknown_type_or_missing_acceptance_criteria_is_refused()
    {
        var unknownType = await PostAsync(Request("deploy"), 400);
        var noCriteria = await PostAsync(Request("research") with { AcceptanceCriteria = " " }, 400);

        Assert.Contains("Unknown task type deploy; one of: refinement, research, design, docs, vault-review, test.", unknownType);
        Assert.Contains("Acceptance criteria: 1 to 4000 characters required.", noCriteria);
    }

    private static CreateTaskRequest Request(string type, string? pbi = null, List<string>? repos = null)
    {
        return new CreateTaskRequest(PowerLoomHost.Vault, type, "Why it fails", "Find out why", Criteria, pbi, repos, null);
    }

    private async Task<string> PutAsync(string path, SaveTaskNotesRequest request, int status)
    {
        var result = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(request).ToUrl(path);
            scenario.StatusCodeShouldBe(status);
        });

        return await result.ReadAsTextAsync();
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

    private async Task SeedPbiAsync(int adoId = AdoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Create task PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    private async Task<LocalItem> LoadAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }
}
