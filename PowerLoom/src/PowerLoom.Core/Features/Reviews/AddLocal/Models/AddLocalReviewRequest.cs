namespace PowerLoom.Features.Reviews.AddLocal.Models;

// POST /api/reviews/local: a branch of a local repo reviewed against a base branch (the repo's default when empty), no
// Azure DevOps needed. PBI: the linked PBI (the number in the branch name when empty).
public sealed record AddLocalReviewRequest(string Vault, string Repo, string Branch, string? BaseBranch, string? Pbi);
