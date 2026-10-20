using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.AddReview.Models;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Reviews;

// Reviews → Add review (user decision 2026-10-21): the active PR of the branch, kept while active whoever's it is; else
// a branch review that follows its branch and can be tested.
[Collection(PowerLoomCollection.Name)]
public sealed class AddReviewTests(PowerLoomHost host)
{
    private const string RepoId = "r-AddPortal";
    private const string RepoName = "AddPortal";
    private const int Pbi = 74501;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task The_branch_of_someone_elses_PR_adds_that_PR_and_the_sync_keeps_it_while_it_is_active()
    {
        await SeedAsync();
        var ado = Ado();
        ado.PullRequests = [OtherPersonsPr(7501, "feature/74501-pr")];
        ado.Details[7501] = new AdoPullRequestDetails(1, [Pbi]);

        var added = await host.Host.PostJson(Request("refs/heads/feature/74501-pr"), "/api/reviews").Receive<AddedReview>();
        await Sync();
        var kept = await RowAsync(7501);
        ado.PullRequests = [];
        await Sync();
        var gone = await RowAsync(7501);

        Assert.Equal((7501, "pull-request"), (added!.PrId, added.Kind));
        Assert.Equal((PullRequestOrigin.User, true, ReviewStatus.Active, $"[{Pbi}]"), (kept.Origin, kept.IsListed, kept.CodeReview!.Status, kept.WorkItemIds));
        Assert.Equal((false, ReviewStatus.Closed), (gone.IsListed, gone.CodeReview!.Status));
    }

    [Fact]
    public async Task A_branch_without_a_PR_becomes_a_branch_review_that_follows_its_branch_and_can_be_tested()
    {
        await SeedAsync();
        var ado = Ado();
        ado.PullRequests = [];
        ado.BranchHeads[$"{RepoId}:feature/74501-branch"] = "h1";

        var added = await host.Host.PostJson(Request("feature/74501-branch"), "/api/reviews").Receive<AddedReview>();
        var twice = await PostAsync(Request("feature/74501-branch"), 409);
        var row = await RowAsync(added!.PrId);
        ado.BranchHeads[$"{RepoId}:feature/74501-branch"] = "h2";
        await Sync();
        var moved = await RowAsync(added.PrId);
        var tested = await host.Host.PostJson(new ReviewIds([added.PrId]), "/api/reviews/test").Receive<ReviewsResult>();
        ado.BranchHeads.Remove($"{RepoId}:feature/74501-branch");
        await Sync();
        var closed = await RowAsync(added.PrId);
        var task = await TaskAsync(tested!.Done.Single().Value);

        Assert.Equal("branch", added.Kind);
        Assert.True(added.PrId >= 9_000_001);
        Assert.Contains("is in Reviews already", twice);
        Assert.Equal((PullRequestOrigin.Local, "refs/heads/development", "h1", $"[{Pbi}]"), (row.Origin, row.TargetRef, row.SourceCommit, row.WorkItemIds));
        Assert.Equal($"https://dev.azure.com/org/proj/_git/{RepoName}?version=GBfeature%2F74501-branch", row.Url);
        Assert.Equal(("h2", true, ReviewStatus.Active), (moved.SourceCommit, moved.IsListed, moved.CodeReview!.Status));
        Assert.Equal((false, ReviewStatus.Closed), (closed.IsListed, closed.CodeReview!.Status));
        Assert.Contains("branch was deleted", closed.CodeReview!.ClosedReason);
        Assert.Equal(JsonValueKind.Null, JsonDocument.Parse(task.Data!).RootElement.GetProperty("pullRequestId").ValueKind);
    }

    [Fact]
    public async Task A_branch_that_does_not_exist_is_refused()
    {
        await SeedAsync();
        Ado().PullRequests = [];

        var refused = await PostAsync(Request("feature/nope"), 404);

        Assert.Contains($"{RepoName} has no branch feature/nope in Azure DevOps or on this PC, and no active pull request from it.", refused);
    }

    // A branch that isn't pushed (user, 2026-10-21): found on the PC through DevHub, tested, not code-reviewed; once
    // pushed, the sync turns it into an Azure DevOps branch review.
    [Fact]
    public async Task A_branch_only_on_this_PC_becomes_a_branch_review_that_turns_into_an_ADO_one_once_pushed()
    {
        await SeedAsync();
        var ado = Ado();
        var pc = host.Host.Services.GetRequiredService<FakeLocalBranches>();
        ado.PullRequests = [];
        pc.Heads[$"{RepoName}:feature/74501-pc"] = "p1";

        var added = await host.Host.PostJson(Request("feature/74501-pc"), "/api/reviews").Receive<AddedReview>();
        var row = await RowAsync(added!.PrId);
        var review = await QueueAsync(added.PrId);
        var tested = await host.Host.PostJson(new ReviewIds([added.PrId]), "/api/reviews/test").Receive<ReviewsResult>();
        ado.BranchHeads[$"{RepoId}:feature/74501-pc"] = "p2";
        await Sync();
        var pushed = await RowAsync(added.PrId);

        Assert.Contains("only on this PC", added.Message);
        Assert.Equal((PullRequestOrigin.Pc, "p1", "", $"Branch feature/74501-pc (this PC)"), (row.Origin, row.SourceCommit, row.Url, row.Title));
        Assert.Contains("the branch is only on this PC: push it", review!.Refused.Single());
        Assert.Single(tested!.Done);
        Assert.Equal((PullRequestOrigin.Local, "p2", true), (pushed.Origin, pushed.SourceCommit, pushed.IsListed));
        Assert.Equal($"https://dev.azure.com/org/proj/_git/{RepoName}?version=GBfeature%2F74501-pc", pushed.Url);
    }

    private async Task<ReviewsResult?> QueueAsync(int prId) => await host.Host.PostJson(new ReviewIds([prId]), "/api/reviews/queue").Receive<ReviewsResult>();

    private static AddReviewRequest Request(string branch) => new(PowerLoomHost.Vault, RepoName, branch, null, null);

    private FakeAdoClient Ado() => host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

    private static AdoPullRequest OtherPersonsPr(int id, string branch)
    {
        return new AdoPullRequest(id, RepoId, RepoName, $"PR {id}", null, false, "pat@x.io", $"refs/heads/{branch}", "refs/heads/development", "c1", "t1", ["kim@x.io"], "2026-10-01T10:00:00Z", $"https://x/pr/{id}");
    }

    private Task<ITrackedSession> Sync() => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncPullRequests(PowerLoomHost.Vault)).AsTask());

    private async Task<string> PostAsync(AddReviewRequest request, int status)
    {
        var result = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request).ToUrl("/api/reviews");
            scenario.StatusCodeShouldBe(status);
        });

        return await result.ReadAsTextAsync();
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);

        if (!await db.Repos.AnyAsync(repo => repo.Id == RepoId))
            db.Repos.Add(new Repo { Id = RepoId, AdoProject = "proj", Name = RepoName, RemoteUrl = $"https://org@dev.azure.com/org/proj/_git/{RepoName}", DefaultBranch = "refs/heads/development", Vault = PowerLoomHost.Vault });

        if (!await db.WorkItems.AnyAsync(item => item.AdoId == Pbi))
            db.WorkItems.Add(new WorkItem { AdoId = Pbi, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Add review PBI", AdoState = "Active", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Development, SyncedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }

    private async Task<PullRequest> RowAsync(int id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PullRequests.AsNoTracking().Include(row => row.CodeReview).SingleAsync(row => row.Id == id);
    }

    private async Task<LocalItem> TaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }
}
