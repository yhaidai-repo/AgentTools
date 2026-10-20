using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Reviews;

// Start test on the Reviews list (user decision 2026-10-21): a test task per linked PBI of the vault, on the PR's
// branch; a PR without one is refused; a second start doesn't test the same branch twice.
[Collection(PowerLoomCollection.Name)]
public sealed class ReviewTestingTests(PowerLoomHost host)
{
    private const int LinkedPr = 7401;
    private const int UnlinkedPr = 7402;
    private const int FirstPbi = 74011;
    private const int SecondPbi = 74012;
    private const int OtherVaultPbi = 74013;

    [Fact]
    public async Task Start_test_creates_a_test_task_per_linked_PBI_on_the_PR_branch_once()
    {
        await SeedAsync();

        var first = await host.Host.PostJson(new ReviewIds([LinkedPr, UnlinkedPr]), "/api/reviews/test").Receive<ReviewsResult>();
        var second = await host.Host.PostJson(new ReviewIds([LinkedPr]), "/api/reviews/test").Receive<ReviewsResult>();
        var tasks = await TasksAsync();
        var data = JsonDocument.Parse(tasks[0].Data!).RootElement;

        Assert.Equal([$"TT-{FirstPbi}-001", $"TT-{SecondPbi}-001"], first!.Done.Select(done => done.Value));
        Assert.Contains($"PR {UnlinkedPr}: it links no PBI of {PowerLoomHost.Vault}", first.Refused.Single());
        Assert.Empty(second!.Done);
        Assert.Contains($"TT-{FirstPbi}-001 already tests PBI-{FirstPbi} on feature/{FirstPbi}-other-payer.", second.Refused[0]);
        Assert.Equal(2, tasks.Count);
        Assert.Equal(("feature/74011-other-payer", LinkedPr, "PVS"), (data.GetProperty("branch").GetString(), data.GetProperty("pullRequestId").GetInt32(), data.GetProperty("repo").GetString()));
        Assert.Equal("Test PBI-74011 on feature/74011-other-payer", tasks[0].Title);
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.AddRange(Pbi(FirstPbi), Pbi(SecondPbi));
        db.PullRequests.Add(Pr(LinkedPr, $"refs/heads/feature/{FirstPbi}-other-payer", $"[{FirstPbi},{SecondPbi},{OtherVaultPbi}]"));
        db.PullRequests.Add(Pr(UnlinkedPr, "refs/heads/feature/no-pbi", "[]"));
        db.CodeReviews.AddRange(new CodeReview { PrId = LinkedPr, Status = ReviewStatus.Active }, new CodeReview { PrId = UnlinkedPr, Status = ReviewStatus.Active });
        await db.SaveChangesAsync();
    }

    private async Task<List<LocalItem>> TasksAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.LocalItems.AsNoTracking().Where(item => item.Kind == ItemKind.Test && (item.PbiId == FirstPbi || item.PbiId == SecondPbi)).OrderBy(item => item.Id).ToListAsync();
    }

    private static WorkItem Pbi(int adoId) => new() { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Active", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Development, SyncedAt = DateTime.UtcNow };

    private static PullRequest Pr(int id, string sourceRef, string workItemIds) => new() { Id = id, Vault = PowerLoomHost.Vault, RepoId = "r", RepoName = "PVS", Title = $"PR {id}", SourceRef = sourceRef, TargetRef = "refs/heads/development", SourceCommit = "c1", WorkItemIds = workItemIds, Url = "https://x", IsListed = true, Iteration = 1 };
}
