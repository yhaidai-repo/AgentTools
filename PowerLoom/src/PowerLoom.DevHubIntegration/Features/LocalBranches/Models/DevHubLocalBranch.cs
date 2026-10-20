namespace PowerLoom.DevHubIntegration.Features.LocalBranches.Models;

// GET /repos/branch on DevHub: the branch's commit in the repo's checkout on the PC.
public sealed record DevHubLocalBranch(string Repo, string Branch, string Head);
