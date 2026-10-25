using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// An unmerged draft holds the agents that wait for drafts, until its merge task is blocked: then nothing would merge it,
// so it stops holding them (user decision 2026-10-13; WT-025 held PBI 36756 silently).
[Collection(PowerLoomCollection.Name)]
public sealed class StuckDraftsTests(PowerLoomHost host)
{
    private const int AdoId = 63004;
    private const string Draft = "pos-stuck-draft-63004";
    private const string MergeTask = "WT-63004";
    private const string Design = "DT-63004-001";

    [Fact]
    public async Task A_draft_holds_while_its_merge_task_can_still_run_and_not_once_it_is_blocked()
    {
        await SeedAsync();

        var whileOpen = await ReasonsOfAsync(Design);

        await SetStatusAsync(MergeTask, ItemStatus.Blocked);

        var onceBlocked = await ReasonsOfAsync(Design);

        Assert.Equal([$"Vault drafts not merged: {Draft}"], whileOpen);
        Assert.Empty(onceBlocked);
    }

    private async Task<List<string>> ReasonsOfAsync(string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == taskId);

        return await TaskValidation.ValidateAsync(db, task, "design", [TaskValidation.Drafts], true, CancellationToken.None);
    }

    private async Task SetStatusAsync(string id, ItemStatus status)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var item = await db.LocalItems.SingleAsync(row => row.Id == id);

        item.Status = status;
        await db.SaveChangesAsync();
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var run = new AgentRun { PbiId = AdoId, Stage = "research", Outcome = RunOutcome.Success, StartedAt = DateTime.UtcNow };

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Stuck draft PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.ReadyForDesign, SyncedAt = DateTime.UtcNow });
        db.AgentRuns.Add(run);
        await db.SaveChangesAsync();

        db.VaultCaptures.Add(new VaultCapture { RunId = run.Id, PbiId = AdoId, Title = "Stuck", Project = "pos", Target = "pos", Captured = "[]", ToFill = "[]", Name = Draft, Assumptions = "[]", Status = "created", Errors = "[]", CreatedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = MergeTask, Kind = ItemKinds.Docs, Vault = PowerLoomHost.Vault, Title = "Merge draft", Status = ItemStatus.Open, Assignee = "agent:tech-writer", Data = $$$"""{"draft":"{{{Draft}}}"}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Design, Kind = ItemKinds.Design, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Design", Status = ItemStatus.Open, Assignee = "agent:design", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }
}
