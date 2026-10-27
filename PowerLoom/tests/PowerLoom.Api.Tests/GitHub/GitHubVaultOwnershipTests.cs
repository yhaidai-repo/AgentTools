using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Domain.Reviews;
using PowerLoom.GitHubIntegration.Client.Models;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.GitHub;

[Collection(PowerLoomCollection.Name)]
public sealed class GitHubVaultOwnershipTests(PowerLoomHost host)
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Same_remote_PR_has_separate_owned_mirrors_and_deletion_state(bool deleteFirst)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var suffix = Guid.NewGuid().ToString("N");
        var a = $"github-a-{suffix}";
        var b = $"github-b-{suffix}";
        const int pbi = 986431;
        // Work item IDs are global; the branch references an A-owned PBI, which B must not inherit.
        var pbiId = pbi + (deleteFirst ? 1 : 0);
        foreach (var vault in new[] { a, b })
        {
            db.Vaults.Add(new Vault { Name = vault, Features = "{}" });
            db.Repos.Add(new Repo { Id = $"{vault}:demo", Vault = vault, Kind = RepoKind.Github, AdoProject = "synthetic", Name = "demo", RemoteUrl = "https://github.com/synthetic/demo.git", DefaultBranch = "main" });
        }
        ReviewFixSeed.Pbi(db, pbiId, a);
        await db.SaveChangesAsync();
        var pr = new GitHubPullRequest("synthetic", "demo", 7, "A title", null, "sam", $"feature/{pbiId}-test", "a-head", "main", "base", false, [], DateTime.UtcNow, "https://github.com/synthetic/demo/pull/7");
        var client = new FakeGitHubClient();
        client.Pulls["synthetic/demo"] = [pr];
        var settings = new GitHubSettings { Enabled = true, Login = "sam", Token = "synthetic" };
        var sync = new GitHubPullRequestSync(db);
        await sync.RunAsync(a, settings, client, CancellationToken.None);
        var original = await db.PullRequests.AsNoTracking().SingleAsync(row => row.Vault == a);
        if (deleteFirst)
        {
            Assert.True((await ReviewDeletion.DeleteAsync(db, original.Id, CancellationToken.None)).Ok);
            db.ChangeTracker.Clear();
        }
        client.Pulls["synthetic/demo"] = [pr with { Title = "B title", HeadSha = "b-head" }];
        await sync.RunAsync(b, settings, client, CancellationToken.None);
        db.ChangeTracker.Clear();
        var preserved = await db.PullRequests.AsNoTracking().Include(row => row.CodeReview).SingleAsync(row => row.Vault == a);
        var added = await db.PullRequests.AsNoTracking().Include(row => row.CodeReview).SingleAsync(row => row.Vault == b);
        Assert.Equal((original.RepoId, original.Title, original.SourceCommit, original.WorkItemIds), (preserved.RepoId, preserved.Title, preserved.SourceCommit, preserved.WorkItemIds));
        Assert.Equal(!deleteFirst, preserved.IsListed);
        Assert.Equal(deleteFirst, preserved.CodeReview is null);
        Assert.NotEqual(original.Id, added.Id);
        Assert.Equal(($"{b}:demo", "B title", "b-head", "[]"), (added.RepoId, added.Title, added.SourceCommit, added.WorkItemIds));
        Assert.NotNull(added.CodeReview);
        Assert.True(added.IsListed);
        Assert.True((await ReviewDeletion.DeleteAsync(db, added.Id, CancellationToken.None)).Ok);
        db.ChangeTracker.Clear();
        await sync.RunAsync(b, settings, client, CancellationToken.None);
        db.ChangeTracker.Clear();
        Assert.Single(await db.PullRequests.Where(row => row.Vault == b).ToListAsync());
        Assert.False((await db.PullRequests.SingleAsync(row => row.Vault == b)).IsListed);
    }
}
