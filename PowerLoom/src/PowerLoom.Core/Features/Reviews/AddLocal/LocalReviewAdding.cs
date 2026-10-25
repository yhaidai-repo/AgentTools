using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Repos;
using PowerLoom.Domain.Reviews;
using PowerLoom.Features.Reviews.AddLocal.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.Features.Reviews.AddLocal;

// Reviews → Add local review (user decision 2026-10-25): a branch of a local repo in the repos root against a base
// branch, like a pull request without one, and without Azure DevOps. The heads are read from the checkout's git files;
// each run reviews the branch's head at its start (a re-run picks up new commits).
public static class LocalReviewAdding
{
    private static readonly string[] UsualBases = ["main", "master"];

    public static async Task<Outcome<AddedLocalReview>> AddAsync(PowerLoomDbContext db, string? reposMount, AddLocalReviewRequest request, CancellationToken cancellation)
    {
        var branch = BranchRefs.NameOf(request.Branch);

        if (branch.Length == 0 || string.IsNullOrWhiteSpace(request.Repo))
            return Outcome<AddedLocalReview>.Failure(Problem.Invalid("Pick a local repository and name a branch."));

        if (reposMount is null)
            return Outcome<AddedLocalReview>.Failure(Problem.Invalid("The repos folder isn't mounted for PowerLoom (Repos:Mount), so local branches can't be read."));

        var repo = await db.Repos.FirstOrDefaultAsync(row => row.Vault == request.Vault && row.Name == request.Repo.Trim() && row.Kind == RepoKind.Local && !row.Excluded, cancellation);

        if (repo is null)
            return Outcome<AddedLocalReview>.Failure(Problem.NotFound($"{request.Repo} isn't an enabled local repository of {request.Vault}."));

        var branches = BranchesOf(Path.Combine(reposMount, repo.Name), repo, branch, request.BaseBranch);

        return branches.Ok ? await AddBranchesAsync(db, request, repo, branches.Value!, cancellation) : Outcome<AddedLocalReview>.Failure(branches.Problem!);
    }

    private static Outcome<LocalBranches> BranchesOf(string checkout, Repo repo, string branch, string? baseBranch)
    {
        var head = GitRefs.HeadOf(checkout, branch);

        if (head is null)
            return Outcome<LocalBranches>.Failure(Problem.NotFound($"{repo.Name} has no branch {branch}."));

        var named = BranchRefs.NameOf(baseBranch ?? "");
        var candidates = named.Length > 0 ? [named] : new[] { repo.DefaultBranch }.OfType<string>().Concat(UsualBases);
        var found = candidates.Select(name => (Name: name, Head: GitRefs.HeadOf(checkout, name))).FirstOrDefault(candidate => candidate.Head is not null);

        if (found.Head is null)
            return Outcome<LocalBranches>.Failure(Problem.NotFound(named.Length > 0 ? $"{repo.Name} has no branch {named}." : $"Name the base branch: {repo.Name} has no {string.Join(" or ", UsualBases)}."));

        return found.Name == branch ? Outcome<LocalBranches>.Failure(Problem.Invalid($"{branch} is its own base: pick another base branch.")) : Outcome<LocalBranches>.Success(new LocalBranches(branch, head, found.Name, found.Head));
    }

    private static async Task<Outcome<AddedLocalReview>> AddBranchesAsync(PowerLoomDbContext db, AddLocalReviewRequest request, Repo repo, LocalBranches branches, CancellationToken cancellation)
    {
        var existing = await db.PullRequests.AsNoTracking().Where(row => row.Origin == PullRequestOrigin.LocalRepo && row.IsListed && row.RepoId == repo.Id && row.SourceRef == BranchRefs.RefOf(branches.Branch)).Select(row => (int?)row.Id).FirstOrDefaultAsync(cancellation);

        if (existing is not null)
            return Outcome<AddedLocalReview>.Failure(Problem.Conflict($"Local review {existing} of {branches.Branch} is in Reviews already."));

        var pbis = await BranchPbis.LinkAsync(db, request.Vault, request.Pbi, branches.Branch, cancellation);

        if (!pbis.Ok)
            return Outcome<AddedLocalReview>.Failure(pbis.Problem!);

        var id = await db.Database.SqlQueryRaw<int>("select nextval('local_pr_id')::int as \"Value\"").SingleAsync(cancellation);

        // The agents clone the repo at its default branch: one the checkout has, when the repo has none yet.
        repo.DefaultBranch ??= branches.Base;
        db.PullRequests.Add(ReviewRow(id, request.Vault, repo, branches, pbis.Value!));
        db.CodeReviews.Add(new CodeReview { PrId = id });
        await db.SaveChangesAsync(cancellation);

        var linked = pbis.Value!.Count > 0 ? $", linked to PBI-{pbis.Value[0]}" : ", no linked PBI";

        return Outcome<AddedLocalReview>.Success(new AddedLocalReview(id, $"Local review {id} added: {branches.Branch} against {branches.Base} in {repo.Name}{linked}."));
    }

    private static PullRequest ReviewRow(int id, string vault, Repo repo, LocalBranches branches, List<int> pbis)
    {
        return new PullRequest
        {
            Id = id, Vault = vault, Origin = PullRequestOrigin.LocalRepo, RepoId = repo.Id, RepoName = repo.Name, Title = $"Branch {branches.Branch}",
            SourceRef = BranchRefs.RefOf(branches.Branch), TargetRef = BranchRefs.RefOf(branches.Base), SourceCommit = branches.BranchHead, TargetCommit = branches.BaseHead,
            Iteration = 1, IsDraft = false, WorkItemIds = JsonSerializer.Serialize(pbis), Url = "", IsListed = true, SyncedAt = DateTime.UtcNow,
        };
    }
}
