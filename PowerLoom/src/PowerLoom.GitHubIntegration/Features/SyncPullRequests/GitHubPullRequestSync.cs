using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Reviews;
using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Client.Models;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.GitHubIntegration.Features.SyncPullRequests;

// Reviews from GitHub (user decision 2026-10-25), like the Azure DevOps check: the open pull requests of the vault's
// enabled GitHub repos that the token's user wrote, is asked to review or has reviewed. Each gets a review to start by
// hand (drafts once published); one that left the list closes. Its id is PowerLoom's own (GitHub numbers repeat across
// repos and could meet Azure DevOps ids): the PR is found by its URL, and a review deleted in PowerLoom stays deleted.
public sealed class GitHubPullRequestSync(PowerLoomDbContext db)
{
    private const string Actor = "pull-requests";
    private const string UnlistedReason = "The PR was merged or closed on GitHub, you're no longer its author or a reviewer, or its repo is switched off or not checked.";

    public async Task<string> RunAsync(string vault, GitHubSettings github, IGitHubClient client, CancellationToken cancellation)
    {
        var mine = await MineAsync(vault, github.Login, await PullRequestSettings.ReadAsync(db, vault, cancellation), client, cancellation);
        var deleted = (await db.DeletedPullRequests.Select(row => row.Id).ToListAsync(cancellation)).ToHashSet();
        var listed = new List<int>();
        var added = 0;

        foreach (var (repo, pr) in mine)
        {
            var upserted = await UpsertAsync(vault, repo, pr, deleted, cancellation);

            listed.AddRange(upserted is null ? [] : [upserted.Value.Id]);
            added += upserted is { IsNewReview: true } ? 1 : 0;
        }

        var closed = await CloseUnlistedAsync(vault, listed, cancellation);

        return $"{listed.Count} GitHub PR(s) you review or wrote, {added} new review(s), {closed} closed";
    }

    public static bool IsMine(GitHubPullRequest pr, string login, IReadOnlySet<string> reviewed)
    {
        return Same(pr.Author, login) || pr.RequestedReviewers.Any(reviewer => Same(reviewer, login)) || reviewed.Contains(pr.Key);
    }

    // The enabled GitHub repos the Pull requests card checks (chosen as owner/name; none chosen = all).
    private async Task<List<(Repo Repo, GitHubPullRequest Pr)>> MineAsync(string vault, string login, PullRequestSettings settings, IGitHubClient client, CancellationToken cancellation)
    {
        var enabled = await db.Repos.AsNoTracking().Where(repo => repo.Vault == vault && repo.Kind == RepoKind.Github && !repo.Excluded).ToListAsync(cancellation);
        var repos = enabled.Where(repo => settings.ChecksRepo($"{repo.AdoProject}/{repo.Name}")).ToList();
        var reviewed = (await client.ListReviewedPullRequestsAsync(login, cancellation)).ToHashSet();
        var mine = new List<(Repo, GitHubPullRequest)>();

        foreach (var repo in repos)
            mine.AddRange((await client.ListOpenPullRequestsAsync(repo.AdoProject, repo.Name, cancellation)).Where(pr => IsMine(pr, login, reviewed)).Select(pr => (repo, pr)));

        return mine;
    }

    // Null when the user deleted the PR's review.
    private async Task<(int Id, bool IsNewReview)?> UpsertAsync(string vault, Repo repo, GitHubPullRequest pr, HashSet<int> deleted, CancellationToken cancellation)
    {
        var row = await db.PullRequests.Include(entry => entry.CodeReview).SingleOrDefaultAsync(entry => entry.Vault == vault && entry.Origin == PullRequestOrigin.Github && entry.Url == pr.HtmlUrl, cancellation);

        if (row is not null && deleted.Contains(row.Id))
            return null;

        var pbis = await BranchPbis.LinkAsync(db, vault, null, pr.HeadRef, cancellation);

        row ??= await NewRowAsync(vault, cancellation);
        Mirror(row, repo, pr, pbis.Ok ? pbis.Value! : []);

        var isNewReview = !pr.IsDraft && row.CodeReview is null;

        if (isNewReview)
            row.CodeReview = new CodeReview { PrId = row.Id };

        await db.SaveChangesAsync(cancellation);

        return (row.Id, isNewReview);
    }

    private async Task<PullRequest> NewRowAsync(string vault, CancellationToken cancellation)
    {
        var id = await db.Database.SqlQueryRaw<int>("select nextval('local_pr_id')::int as \"Value\"").SingleAsync(cancellation);
        var row = new PullRequest { Id = id, Vault = vault, Origin = PullRequestOrigin.Github, Iteration = 0 };

        db.PullRequests.Add(row);

        return row;
    }

    // GitHub has no push count: a new head commit counts as one more push, so the page shows new pushes since a review.
    private static void Mirror(PullRequest row, Repo repo, GitHubPullRequest pr, List<int> pbis)
    {
        row.Iteration = row.SourceCommit == pr.HeadSha ? row.Iteration : row.Iteration + 1;
        row.RepoId = repo.Id;
        row.RepoName = repo.Name;
        row.Title = pr.Title;
        row.DescriptionMd = pr.Body;
        row.Author = pr.Author;
        row.SourceRef = $"refs/pull/{pr.Number}/head";
        row.TargetRef = BranchRefs.RefOf(pr.BaseRef);
        row.SourceCommit = pr.HeadSha;
        row.TargetCommit = pr.BaseSha;
        row.IsDraft = pr.IsDraft;
        row.WorkItemIds = JsonSerializer.Serialize(pbis);
        row.Url = pr.HtmlUrl;
        row.AdoCreatedAt = pr.CreatedAt;
        row.IsListed = true;
        row.SyncedAt = DateTime.UtcNow;
    }

    private async Task<int> CloseUnlistedAsync(string vault, List<int> listed, CancellationToken cancellation)
    {
        var gone = await db.PullRequests.Where(row => row.Vault == vault && row.Origin == PullRequestOrigin.Github && (row.IsListed || row.CodeReview != null && row.CodeReview.Status == ReviewStatus.Active) && !listed.Contains(row.Id)).ToListAsync(cancellation);

        var closed = 0;
        foreach (var pr in gone)
            if (await UnlistAsync(pr, cancellation)) closed++;

        return closed;
    }

    private async Task<bool> UnlistAsync(PullRequest pr, CancellationToken cancellation)
    {
        pr.IsListed = false;
        pr.SyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellation);

        if (await db.CodeReviews.AnyAsync(review => review.PrId == pr.Id && review.Status == ReviewStatus.Active, cancellation))
            return await ReviewClosing.CloseAsync(db, pr.Id, UnlistedReason, Actor, cancellation) is null;
        return false;
    }

    private static bool Same(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
