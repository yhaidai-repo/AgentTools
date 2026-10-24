namespace PowerLoom.AdoIntegration.Features.AddReview.Models;

// POST /api/reviews: a review of a branch of a catalog repo. Target branch: what a branch review diffs against (the
// repo's default when empty). PBI: a branch review's linked PBI (the number in the branch name when empty).
public sealed record AddReviewRequest(string Vault, string Repo, string Branch, string? TargetBranch, string? Pbi);
