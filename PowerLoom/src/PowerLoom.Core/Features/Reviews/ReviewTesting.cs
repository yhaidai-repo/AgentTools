using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Features.Tasks.CreateTask;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Reviews;

// The Reviews list's Start test (user decision 2026-10-21): one test task per PBI the pull request links that is in
// the vault, on the PR's source branch; a PR that links none is refused. A PBI already tested on that branch by an open
// task gets no second one.
public sealed class ReviewTesting(PowerLoomDbContext db, TaskCreation creation)
{
    private const string BranchPrefix = "refs/heads/";
    private const int TitleMax = 120;

    public async Task<ReviewsResult> StartAsync(IReadOnlyList<int> prIds, CancellationToken cancellation)
    {
        var result = new ReviewsResult([], []);

        foreach (var prId in prIds.Distinct())
            await StartForAsync(result, prId, cancellation);

        return result;
    }

    private async Task StartForAsync(ReviewsResult result, int prId, CancellationToken cancellation)
    {
        var pr = await db.PullRequests.AsNoTracking().SingleOrDefaultAsync(row => row.Id == prId, cancellation);

        if (pr is null)
        {
            result.Refused.Add($"PR {prId}: not in PowerLoom.");

            return;
        }

        var pbis = await LinkedPbisAsync(pr, cancellation);

        if (pbis.Count == 0)
        {
            result.Refused.Add($"PR {prId}: it links no PBI of {pr.Vault}; link one in Azure DevOps (or name it on a branch review) first.");

            return;
        }

        foreach (var pbiId in pbis)
            Collect(result, prId, await CreateAsync(pr, pbiId, cancellation));
    }

    private async Task<List<int>> LinkedPbisAsync(PullRequest pr, CancellationToken cancellation)
    {
        var linked = JsonSerializer.Deserialize<List<int>>(pr.WorkItemIds) ?? [];

        return await db.WorkItems.AsNoTracking().Where(item => linked.Contains(item.AdoId) && item.Vault == pr.Vault).Select(item => item.AdoId).OrderBy(id => id).ToListAsync(cancellation);
    }

    private async Task<Outcome<string>> CreateAsync(PullRequest pr, int pbiId, CancellationToken cancellation)
    {
        var branch = BranchOf(pr.SourceRef);
        var open = await OpenTestOfBranchAsync(pbiId, branch, cancellation);

        if (open is not null)
            return Outcome<string>.Failure(Problem.Conflict($"{open} already tests PBI-{pbiId} on {branch}."));

        var created = await creation.CreateAsync(TaskOf(pr, pbiId, branch), cancellation);

        return created.Ok ? Outcome<string>.Success(created.Value!.Id) : Outcome<string>.Failure(created.Problem!);
    }

    private static NewTask TaskOf(PullRequest pr, int pbiId, string branch)
    {
        var title = $"Test PBI-{pbiId} on {branch}";
        var description = $"Test PBI-{pbiId} on branch {branch} of {pr.RepoName} (PR {pr.Id}: {pr.Title}).";
        var criteria = $"Every acceptance criterion of PBI-{pbiId} has a verdict on branch {branch}: pass, fail with a bug, or blocked with why.";
        var extra = new Dictionary<string, object?> { ["branch"] = branch, ["pullRequestId"] = pr.Id, ["repo"] = pr.RepoName };

        return new NewTask(pr.Vault, "test", title.Length > TitleMax ? title[..TitleMax] : title, description, criteria, pbiId, [], Extra: extra);
    }

    private async Task<string?> OpenTestOfBranchAsync(int pbiId, string branch, CancellationToken cancellation)
    {
        var open = await db.LocalItems.AsNoTracking()
            .Where(item => item.PbiId == pbiId && item.Kind == ItemKind.Test && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress))
            .Select(item => new { item.Id, item.Data })
            .ToListAsync(cancellation);

        return open.FirstOrDefault(item => ItemData.StringOf(item.Data, "branch") == branch)?.Id;
    }

    private static string BranchOf(string sourceRef) => sourceRef.StartsWith(BranchPrefix, StringComparison.Ordinal) ? sourceRef[BranchPrefix.Length..] : sourceRef;

    private static void Collect(ReviewsResult result, int prId, Outcome<string> outcome)
    {
        if (outcome.Ok)
            result.Done.Add(new ReviewOutcome(prId, outcome.Value!));
        else
            result.Refused.Add($"PR {prId}: {outcome.Problem!.Detail}");
    }
}
