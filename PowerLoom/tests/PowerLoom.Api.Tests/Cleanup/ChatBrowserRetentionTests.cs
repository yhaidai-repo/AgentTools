using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;
using PowerLoom.DevHubIntegration.Settings;
using PowerLoom.Features.Cleanup;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Api.Tests.Cleanup;

[Collection(PowerLoomCollection.Name)]
public sealed class ChatBrowserRetentionTests(PowerLoomHost host)
{
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, false)]
    [InlineData(false, true)]
    public async Task Only_old_inactive_recordings_of_the_owned_vault_expire(bool dryRun, bool failure)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var suffix = Guid.NewGuid().ToString("N");
        var a = $"chat-a-{suffix}";
        var b = $"chat-b-{suffix}";
        db.Vaults.AddRange(new Vault { Name = a, Features = "{}" }, new Vault { Name = b, Features = "{}" });
        await db.SaveChangesAsync();
        var settings = new DevHubSettingsStore(db);
        await settings.SaveAsync(a, new DevHubSettings { Enabled = true, Token = "synthetic" }, CancellationToken.None);
        var now = DateTimeOffset.UtcNow;
        var old = now.AddDays(-30).UtcDateTime;
        var active = now.AddMinutes(5).UtcDateTime;
        var expired = "powerloom-chat-expired-" + suffix;
        var closed = "powerloom-chat-closed-" + suffix;
        var live = "powerloom-chat-live-" + suffix;
        var recent = "powerloom-chat-recent-" + suffix;
        var other = "powerloom-chat-other-" + suffix;
        var unknown = "powerloom-chat-legacy-" + suffix;
        await db.Database.ExecuteSqlAsync($"insert into chat_browser_owner values ({expired},{a},{old},null), ({closed},{a},{active},{old}), ({live},{a},{active},null), ({recent},{a},{old},null), ({other},{b},{old},{old})");
        var artefacts = new FixtureArtefacts(failure);
        foreach (var owner in new[] { expired, closed, live, other, unknown }) artefacts.Owners.Add(new OwnerArtefacts(owner, 42, old));
        artefacts.Owners.Add(new OwnerArtefacts(recent, 42, now.UtcDateTime));
        var cleaner = new BrowserArtefactsCleaner(db, settings, artefacts);
        var result = await cleaner.CleanAsync(new CleanupContext(a, new CleanupSettings { DryRun = dryRun, BrowserArtefactDays = 14 }, now), CancellationToken.None);
        Assert.Equal(new[] { expired, closed }.Order(), result.Actions.Select(action => action.Target).Order());
        Assert.All(result.Actions, action => { Assert.Equal(!dryRun && !failure, action.Deleted); Assert.Equal(failure, action.Error is not null); });
        Assert.Equal(2, artefacts.Deletes.Count);
        Assert.All(artefacts.Deletes, entry => Assert.Equal(dryRun, entry.DryRun));
    }

    private sealed class FixtureArtefacts(bool failure) : IDevHubBrowserArtefacts
    {
        public List<OwnerArtefacts> Owners { get; } = [];
        public List<(string Owner, bool DryRun)> Deletes { get; } = [];
        public Task<IReadOnlyList<OwnerArtefacts>?> ListOwnersAsync(DevHubTarget target, CancellationToken cancellation) => Task.FromResult<IReadOnlyList<OwnerArtefacts>?>(Owners);
        public Task<DeletedArtefacts?> DeleteOwnerAsync(DevHubTarget target, string owner, bool dryRun, CancellationToken cancellation)
        {
            Deletes.Add((owner, dryRun));
            return Task.FromResult(failure ? null : new DeletedArtefacts(owner, 1, 42, dryRun));
        }
    }
}
