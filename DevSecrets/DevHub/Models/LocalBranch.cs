namespace DevSecrets.DevHub.Models;

// GET /repos/branch: a branch of a repo's checkout on this PC (map.json `repos`) and its commit.
public sealed record LocalBranch(string Repo, string Branch, string Head);
