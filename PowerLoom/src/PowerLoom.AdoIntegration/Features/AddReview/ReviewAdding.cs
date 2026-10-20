using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.AddReview.Models;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.AdoIntegration.Features.AddReview;

// Reviews → Add review (user decision 2026-10-21): the active ADO pull request from the branch, kept in Reviews while
// it is active whoever's it is; without one, a branch review: no PR, the branch diffed against a target branch, its
// linked PBI named or read from the branch name (feature/30474-…). Only ADO catalog repos: a branch review's head comes
// from ADO.
public sealed partial class ReviewAdding(PowerLoomDbContext db, AdoSettingsStore settings, IAdoClientFactory clients)
{
    private const string BranchPrefix = BranchRefs.Prefix;
    private const string FallbackTarget = "main";

    public async Task<Outcome<AddedReview>> AddAsync(AddReviewRequest request, CancellationToken cancellation)
    {
        var branch = BranchOf(request.Branch);

        if (branch.Length == 0 || string.IsNullOrWhiteSpace(request.Repo))
            return Outcome<AddedReview>.Failure(Problem.Invalid("Pick a repository and name a branch."));

        var ado = await settings.ReadAdoAsync(request.Vault, cancellation);

        if (ado is null || !ado.IsConfigured)
            return Outcome<AddedReview>.Failure(Problem.Invalid($"The Azure DevOps settings of {request.Vault} are not set up."));

        var repo = await RepoOfAsync(request.Vault, request.Repo.Trim(), cancellation);

        if (repo is null)
            return Outcome<AddedReview>.Failure(Problem.NotFound($"{request.Repo} isn't an enabled Azure DevOps repository of {request.Vault}."));

        var client = clients.For(new AdoConnection(ado.OrgUrl, ado.Project, ado.Team, ado.Pat));
        var pr = (await client.ListActivePullRequestsAsync(cancellation)).Where(candidate => candidate.RepoId == repo.Id && candidate.SourceRef == BranchPrefix + branch && candidate.SourceCommit is not null).MaxBy(candidate => candidate.Id);

        if (pr is not null)
            return Outcome<AddedReview>.Success(await AddPullRequestAsync(request.Vault, client, pr, cancellation));

        return await AddBranchReviewAsync(request, client, repo, branch, cancellation);
    }

    private async Task<Repo?> RepoOfAsync(string vault, string name, CancellationToken cancellation)
    {
        return await db.Repos.AsNoTracking().FirstOrDefaultAsync(repo => repo.Vault == vault && repo.Name == name && repo.Kind == RepoKind.Ado && !repo.Excluded, cancellation);
    }

    // A PR deleted from Reviews before comes back: the user asked for it.
    private async Task<AddedReview> AddPullRequestAsync(string vault, IAdoClient client, AdoPullRequest pr, CancellationToken cancellation)
    {
        var row = await db.PullRequests.Include(entry => entry.CodeReview).SingleOrDefaultAsync(entry => entry.Id == pr.Id, cancellation);
        var known = row is { IsListed: true, CodeReview: not null };

        if (known)
            return new AddedReview(pr.Id, "pull-request", $"PR {pr.Id} ({pr.Title}) is in Reviews already.");

        await db.DeletedPullRequests.Where(deleted => deleted.Id == pr.Id).ExecuteDeleteAsync(cancellation);

        if (row is null)
            db.PullRequests.Add(row = new PullRequest { Id = pr.Id, Vault = vault, Origin = PullRequestOrigin.User });
        else if (row.Origin == PullRequestOrigin.Sync && !row.IsListed)
            row.Origin = PullRequestOrigin.User;

        PullRequestMirror.Mirror(row, pr, await client.GetPullRequestDetailsAsync(pr.RepoId, pr.Id, cancellation));
        row.CodeReview ??= new CodeReview { PrId = pr.Id };
        await db.SaveChangesAsync(cancellation);

        return new AddedReview(pr.Id, "pull-request", $"PR {pr.Id} ({pr.Title}) added: it's the active pull request from {BranchOf(pr.SourceRef)}.");
    }

    private async Task<Outcome<AddedReview>> AddBranchReviewAsync(AddReviewRequest request, IAdoClient client, Repo repo, string branch, CancellationToken cancellation)
    {
        var existing = await db.PullRequests.AsNoTracking().Where(row => row.Origin == PullRequestOrigin.Local && row.IsListed && row.RepoId == repo.Id && row.SourceRef == BranchPrefix + branch).Select(row => (int?)row.Id).FirstOrDefaultAsync(cancellation);

        if (existing is not null)
            return Outcome<AddedReview>.Failure(Problem.Conflict($"Branch review {existing} of {branch} is in Reviews already."));

        var head = await client.GetBranchHeadAsync(repo.Id, branch, cancellation);

        if (head is null)
            return Outcome<AddedReview>.Failure(Problem.NotFound($"{repo.Name} has no branch {branch} and no active pull request from it."));

        var pbis = await LinkedPbisAsync(request.Vault, request.Pbi, branch, cancellation);

        if (!pbis.Ok)
            return Outcome<AddedReview>.Failure(pbis.Problem!);

        var id = await db.Database.SqlQueryRaw<int>("select nextval('local_pr_id')::int as \"Value\"").SingleAsync(cancellation);
        var target = BranchOf(request.TargetBranch ?? "") is { Length: > 0 } named ? named : BranchOf(repo.DefaultBranch ?? FallbackTarget);

        db.PullRequests.Add(BranchReviewRow(id, request.Vault, repo, branch, target, head, pbis.Value!));
        db.CodeReviews.Add(new CodeReview { PrId = id });
        await db.SaveChangesAsync(cancellation);

        var linked = pbis.Value!.Count > 0 ? $", linked to PBI-{pbis.Value[0]}" : ", no linked PBI (Start test needs one)";

        return Outcome<AddedReview>.Success(new AddedReview(id, "branch", $"Branch review {id} added: {branch} against {target}{linked}."));
    }

    private static PullRequest BranchReviewRow(int id, string vault, Repo repo, string branch, string target, string head, List<int> pbis)
    {
        return new PullRequest
        {
            Id = id, Vault = vault, Origin = PullRequestOrigin.Local, RepoId = repo.Id, RepoName = repo.Name, Title = $"Branch {branch}",
            SourceRef = BranchPrefix + branch, TargetRef = BranchPrefix + target, SourceCommit = head, Iteration = 1, IsDraft = false,
            WorkItemIds = JsonSerializer.Serialize(pbis), Url = BranchUrl(repo.RemoteUrl, branch), IsListed = true, SyncedAt = DateTime.UtcNow,
        };
    }

    // The named PBI, or the number in the branch name when that is a PBI of the vault (create-branch names branches so).
    private async Task<Outcome<List<int>>> LinkedPbisAsync(string vault, string? pbi, string branch, CancellationToken cancellation)
    {
        if (!string.IsNullOrWhiteSpace(pbi))
        {
            var named = int.TryParse(pbi.Trim().TrimStart('#'), out var id) && await IsPbiOfAsync(vault, id, cancellation);

            return named ? Outcome<List<int>>.Success([id]) : Outcome<List<int>>.Failure(Problem.NotFound($"{pbi} isn't a PBI of {vault}."));
        }

        var match = BranchPbi().Match(branch);

        if (match.Success && int.TryParse(match.Groups[1].Value, out var fromBranch) && await IsPbiOfAsync(vault, fromBranch, cancellation))
            return Outcome<List<int>>.Success([fromBranch]);

        return Outcome<List<int>>.Success([]);
    }

    private Task<bool> IsPbiOfAsync(string vault, int adoId, CancellationToken cancellation) => db.WorkItems.AnyAsync(item => item.AdoId == adoId && item.Vault == vault, cancellation);

    private static string BranchOf(string name) => BranchRefs.NameOf(name);

    // The branch in the ADO web UI (the repo's remote without the user part).
    private static string BranchUrl(string remoteUrl, string branch) => $"{UserPart().Replace(remoteUrl, "//")}?version=GB{Uri.EscapeDataString(branch)}";

    [GeneratedRegex(@"(?:^|/)(\d{4,7})(?:[-_/.]|$)")]
    private static partial Regex BranchPbi();

    [GeneratedRegex(@"//[^/@]+@")]
    private static partial Regex UserPart();
}
