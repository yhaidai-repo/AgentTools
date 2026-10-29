using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Pbis;

// guide_asset rows reference their support-guide task (ON DELETE RESTRICT), so deleting the PBI removes them first.
[Collection(PowerLoomCollection.Name)]
public sealed class PbiGuideAssetDeletionTests(PowerLoomHost host)
{
    [Fact]
    public async Task Deleting_the_pbi_deletes_its_support_guide_task_and_assets()
    {
        const int adoId = 69003;
        const string taskId = "SG-69003";
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await SeedAsync(db, adoId, taskId);

        var deleted = await PbiDeletion.DeleteAsync(db, adoId, CancellationToken.None);

        Assert.True(deleted.Ok);
        Assert.False(await db.LocalItems.AnyAsync(item => item.Id == taskId));
        Assert.False(await db.Set<GuideAsset>().AnyAsync(asset => asset.TaskId == taskId));
    }

    private static async Task SeedAsync(PowerLoomDbContext db, int adoId, string taskId)
    {
        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "The login page", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = taskId, Kind = "support-guide", PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Guide", Status = ItemStatus.Open, Assignee = "agent:support-guide", HeldBy = "[]" });
        await db.SaveChangesAsync();

        db.Set<GuideAsset>().Add(new GuideAsset { Id = Guid.NewGuid(), TaskId = taskId, Vault = PowerLoomHost.Vault, Name = "shot.png", Sha256 = "abc", Content = [1, 2, 3], CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }
}
