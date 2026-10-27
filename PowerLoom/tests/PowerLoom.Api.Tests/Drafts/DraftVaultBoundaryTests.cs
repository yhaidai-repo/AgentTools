using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Drafts;

[Collection(PowerLoomCollection.Name)]
public sealed class DraftVaultBoundaryTests(PowerLoomHost host)
{
    [Theory]
    [InlineData("2026-10-20", 980120)]
    [InlineData("2026-10-21", 980121)]
    public async Task S2_01_Drafts_with_the_same_name_have_their_own_vault_and_PBI(string captured, int id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var vault = $"draft-boundary-{id}";
        var name = $"same-name-{id}";
        db.Vaults.Add(new Vault { Name = vault, Features = "{}" });
        ReviewFixSeed.Pbi(db, id, vault);
        ReviewFixSeed.Pbi(db, id + 100, PowerLoomHost.Vault);
        ReviewFixSeed.Capture(db, id, name);
        await db.SaveChangesAsync();
        // The other vault's newer capture must not win the lookup.
        ReviewFixSeed.Capture(db, id + 100, name);
        await db.SaveChangesAsync();
        var draft = new NewDraftTask(name, name, "test", "2026-10-20", "test", "test", $"draft/{name}.md");
        var first = await DraftTasks.CreateIfMissingAsync(db, PowerLoomHost.Vault, draft, CancellationToken.None);
        var second = await DraftTasks.CreateIfMissingAsync(db, vault, draft with { Captured = captured }, CancellationToken.None);
        Assert.NotNull(first);
        Assert.NotNull(second);
        var task = await db.LocalItems.AsNoTracking().SingleAsync(row => row.Id == second);
        Assert.Equal((vault, id), (task.Vault, task.PbiId));
        Assert.Null(await DraftTasks.CreateIfMissingAsync(db, vault, draft with { Captured = captured }, CancellationToken.None));
    }

    [Fact]
    public async Task S2_02_Only_a_blocked_merge_in_the_same_vault_exempts_a_capture()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        const int id = 980122;
        const string vault = "stuck-boundary";
        const string name = "same-name-stuck-boundary";
        db.Vaults.Add(new Vault { Name = vault, Features = "{}" });
        ReviewFixSeed.Pbi(db, id, vault);
        ReviewFixSeed.Capture(db, id, name);
        var other = ReviewFixSeed.Item(db, "WT-boundary-001", PowerLoomHost.Vault);
        other.Status = ItemStatus.Blocked;
        other.Data = $$"""{"draft":"{{name}}"}""";
        var task = ReviewFixSeed.Item(db, "DT-boundary-001", vault, ItemKinds.Design, id);
        await db.SaveChangesAsync();
        Assert.Single(await TaskValidation.ValidateAsync(db, task, "design", [TaskValidation.Drafts], true, CancellationToken.None));
        var local = ReviewFixSeed.Item(db, "WT-boundary-002", vault);
        local.Status = ItemStatus.Blocked;
        local.Data = other.Data;
        await db.SaveChangesAsync();
        Assert.Empty(await TaskValidation.ValidateAsync(db, task, "design", [TaskValidation.Drafts], true, CancellationToken.None));
    }
}
