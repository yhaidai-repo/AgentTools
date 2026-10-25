using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Contracts;
using PowerLoom.Features.Pbis.Delete.Models;
using PowerLoom.Features.Pbis.Prepare.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Pbis;

[Collection(PowerLoomCollection.Name)]
public sealed class PreparePbiTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Prepare_writes_the_notes_queues_a_refinement_task_and_delete_removes_them()
    {
        const int adoId = 61001;
        var folder = Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "pbi", $"PBI-{adoId}-the-login-page");

        await SeedAsync(adoId);

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new PrepareRequest([adoId, 61999])).ToUrl("/api/pbis/prepare");
            scenario.StatusCodeShouldBe(202);
        }));
        var pbi = await LoadAsync(adoId);
        var note = await File.ReadAllTextAsync(Path.Combine(folder, $"PBI-{adoId}.md"));
        var index = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "backlog-index.md"));

        Assert.Single(session.Executed.MessagesOf<PbiChanged>());
        // Prepare set ready-for-refinement; the open question then derives waiting-human.
        Assert.Equal((PipelineStatus.WaitingHuman, $"pbi/PBI-{adoId}-the-login-page/PBI-{adoId}.md"), (pbi.PipelineStatus, pbi.VaultPath));
        Assert.Equal($"RT-{adoId}-001", (await OpenTasksAsync(adoId)).Single());
        Assert.Contains("status: \"waiting-human\"", note);
        Assert.Contains("Scope is clear.\n\nDetails: [[PBI-61001-refinement]] (v1)", note);
        Assert.Contains("| [[Q-61001-001]] | question | open | Which tenant? |", note);
        Assert.Contains("## Notes\nKeep this.", note);
        Assert.Contains("## Scope in\n\n- Login", await File.ReadAllTextAsync(Path.Combine(folder, $"PBI-{adoId}-refinement.md")));
        Assert.Contains("| 1 | Add the form | POS | src/Login.tsx | new component | yes |", await File.ReadAllTextAsync(Path.Combine(folder, $"PBI-{adoId}-design.md")));
        Assert.Contains("## Options\n\n- A\n- B", await File.ReadAllTextAsync(Path.Combine(folder, "questions", $"Q-{adoId}-001.md")));
        Assert.True(File.Exists(Path.Combine(folder, "tasks", $"RT-{adoId}-001.md")));
        Assert.Contains($"| [[PBI-{adoId}]] | The login page | Committed |", index);

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new DeleteRequest([adoId, 61999])).ToUrl("/api/pbis");
            scenario.StatusCodeShouldBeOk();
        }));

        Assert.False(Directory.Exists(folder));
        Assert.DoesNotContain($"PBI-{adoId}", await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "backlog-index.md")));
        Assert.True(await RememberedAsDeletedAsync(adoId));
    }

    private async Task SeedAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        Directory.CreateDirectory(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "pbi", $"PBI-{adoId}-the-login-page"));
        await File.WriteAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "pbi", $"PBI-{adoId}-the-login-page", $"PBI-{adoId}.md"), "# old\n\n## Notes\nKeep this.\n");
        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "The login page", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        db.Refinements.Add(new Refinement { PbiId = adoId, Version = 1, Summary = "Scope is clear.", ScopeIn = """["Login"]""", ScopeOut = "[]", AcGaps = "[]", Dependencies = "[]", Repos = "[]", Assumptions = "[]", RelevantDocs = "[]", DocsRead = "[]", Skills = "[]" });
        db.Designs.Add(new Design { PbiId = adoId, Version = 1, Approach = "Simple.", Alternatives = "[]", Plan = """[{"step":"Add the form","repo":"POS","locations":["src/Login.tsx"],"change":"new component","agentDoable":true}]""", Risks = "[]", Tests = "[]", Assumptions = "[]", EstimateBasis = "guess", Complexity = 2 });
        db.TestCases.Add(new TestCase { PbiId = adoId, AdoId = 71001, Title = "Login works", State = "Ready", Rev = 1, StepsMd = "1. Open the page" });
        db.LocalItems.Add(new LocalItem { Id = $"Q-{adoId}-001", Kind = ItemKinds.Question, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Which tenant?", Status = ItemStatus.Open, Assignee = "human", Body = "Tenant?", Data = """{"why":"routing","options":["A","B"]}""", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private async Task<WorkItem> LoadAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == adoId);
    }

    private async Task<List<string>> OpenTasksAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId && item.Kind == ItemKinds.Refinement && item.Assignee.StartsWith("agent:") && item.Status == ItemStatus.Open).Select(item => item.Id).ToListAsync();
    }

    private async Task<bool> RememberedAsDeletedAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.DeletedPbis.AnyAsync(row => row.AdoId == adoId) && !await db.WorkItems.AnyAsync(row => row.AdoId == adoId) && !await db.LocalItems.AnyAsync(item => item.PbiId == adoId) && !await db.TestCases.AnyAsync(row => row.PbiId == adoId);
    }
}
