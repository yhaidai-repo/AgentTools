using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Features.Reviews.AddLocal.Models;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Reviews;

// Reviews → Add local review (user decision 2026-10-25): a branch of a local repo against a base, no Azure DevOps.
[Collection(PowerLoomCollection.Name)]
public sealed class LocalReviewTests(PowerLoomHost host)
{
    private const string Folder = "local-review-app";
    private const string AdoRepoName = "LocalReviewAdo";
    private const int Pbi = 74601;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_local_branch_is_reviewed_against_the_checkout_s_branch_and_queues_without_Azure_DevOps()
    {
        await SeedAsync();

        var added = await host.Host.PostJson(Request("feature/74601-login", null), "/api/reviews/local").Receive<AddedLocalReview>();
        var row = await RowAsync(added!.PrId);
        var queued = await host.Host.PostJson(new ReviewIds([added.PrId]), "/api/reviews/queue").Receive<ReviewsResult>();

        Assert.Equal((PullRequestOrigin.LocalRepo, "refs/heads/feature/74601-login", "refs/heads/develop"), (row.Origin, row.SourceRef, row.TargetRef));
        Assert.Equal((FakeCheckout.Sha('b'), FakeCheckout.Sha('a'), "", $"[{Pbi}]"), (row.SourceCommit, row.TargetCommit, row.Url, row.WorkItemIds));
        Assert.Contains("feature/74601-login against develop", added.Message);
        Assert.Single(queued!.Done);
    }

    [Fact]
    public async Task The_same_branch_twice_a_missing_branch_and_an_ADO_repo_are_refused()
    {
        await SeedAsync();
        await host.Host.PostJson(Request("feature/twice", "release/1"), "/api/reviews/local").Receive<AddedLocalReview>();

        await PostAsync(Request("feature/twice", null), HttpStatusCode.Conflict);
        await PostAsync(Request("feature/missing", null), HttpStatusCode.NotFound);
        await PostAsync(Request("feature/twice", "feature/twice"), HttpStatusCode.BadRequest);
        await PostAsync(new AddLocalReviewRequest(PowerLoomHost.Vault, AdoRepoName, "feature/twice", null, null), HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task The_Azure_DevOps_sync_leaves_a_local_review_listed()
    {
        await SeedAsync();
        var added = await host.Host.PostJson(Request("feature/kept", null), "/api/reviews/local").Receive<AddedLocalReview>();

        await SaveAdoSettingsAsync();
        host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client.PullRequests = [];
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncPullRequests(PowerLoomHost.Vault)).AsTask());

        Assert.True((await RowAsync(added!.PrId)).IsListed);
    }

    private static AddLocalReviewRequest Request(string branch, string? baseBranch) => new(PowerLoomHost.Vault, Folder, branch, baseBranch, null);

    private async Task PostAsync(AddLocalReviewRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request).ToUrl("/api/reviews/local");
            scenario.StatusCodeShouldBe(status);
        });
    }

    // The checkout has develop out, so the repo's default branch is develop; the PBI's number names the first branch.
    private async Task SeedAsync()
    {
        FakeCheckout.Create(host.ReposRoot, Folder, "develop", new()
        {
            ["develop"] = FakeCheckout.Sha('a'), ["feature/74601-login"] = FakeCheckout.Sha('b'), ["feature/twice"] = FakeCheckout.Sha('d'), ["feature/kept"] = FakeCheckout.Sha('e'),
        }, new() { ["release/1"] = FakeCheckout.Sha('c') });

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (!await db.Repos.AnyAsync(repo => repo.Name == Folder))
            await host.Host.PostJson(new AddLocalRepoRequest(Folder), $"/api/vaults/{PowerLoomHost.Vault}/repos/local").Receive<RepoSummary>();

        if (!await db.Repos.AnyAsync(repo => repo.Name == AdoRepoName))
            db.Repos.Add(new Repo { Id = "r-" + AdoRepoName, AdoProject = "proj", Name = AdoRepoName, RemoteUrl = $"https://dev.azure.com/org/proj/_git/{AdoRepoName}", Vault = PowerLoomHost.Vault });

        if (!await db.WorkItems.AnyAsync(item => item.AdoId == Pbi))
            db.WorkItems.Add(new WorkItem { AdoId = Pbi, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Local review PBI", AdoState = "Active", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Development, SyncedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }

    private async Task SaveAdoSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
    }

    private async Task<PullRequest> RowAsync(int id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PullRequests.AsNoTracking().SingleAsync(row => row.Id == id);
    }
}
