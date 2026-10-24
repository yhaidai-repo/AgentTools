using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// A task an agent created waits for the items it depends on (chaining v2, user decision 2026-10-13); any close releases it.
[Collection(PowerLoomCollection.Name)]
public sealed class TaskDependenciesTests(PowerLoomHost host)
{
    private const int AdoId = 63003;
    private const string Question = "Q-63003-001";
    private const string Cancelled = "AT-63003-001";
    private const string Design = "DT-63003-001";

    [Fact]
    public async Task A_task_waits_for_its_open_dependencies_and_starts_once_they_close()
    {
        await SeedAsync();

        var held = await ReasonsOfAsync(Design);

        await SetStatusAsync(Question, ItemStatus.Answered);

        var released = await ReasonsOfAsync(Design);

        Assert.Equal([$"Waiting for {Question}"], held);
        Assert.Empty(released);
    }

    private async Task<List<string>> ReasonsOfAsync(string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == taskId);

        return await TaskValidation.ValidateAsync(db, task, "design", [], true, CancellationToken.None);
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

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Dependencies PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.ReadyForDesign, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = Question, Kind = ItemKinds.Question, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Which field is the End Date?", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Cancelled, Kind = ItemKinds.Research, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = ItemStatus.Cancelled, Assignee = "agent:research", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = Design, Kind = ItemKinds.Design, PbiId = AdoId, Vault = PowerLoomHost.Vault, Title = "Design", Status = ItemStatus.Open, Assignee = "agent:design", Data = $$$"""{"dependsOn":["{{{Question}}}","{{{Cancelled}}}"]}""", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }
}
