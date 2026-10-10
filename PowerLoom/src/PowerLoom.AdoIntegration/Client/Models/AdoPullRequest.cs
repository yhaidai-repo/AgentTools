namespace PowerLoom.AdoIntegration.Client.Models;

// `Reviewers`: people named on the PR (not groups), as unique names (e-mail). `Url`: the PR's page in the ADO web UI.
public sealed record AdoPullRequest(
    int Id,
    string RepoId,
    string RepoName,
    string Title,
    string? Description,
    bool IsDraft,
    string? Author,
    string SourceRef,
    string TargetRef,
    string? SourceCommit,
    string? TargetCommit,
    IReadOnlyList<string> Reviewers,
    string? CreatedAt,
    string Url);
