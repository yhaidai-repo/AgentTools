using System.Globalization;
using System.Text.Json;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// Copies an ADO pull request into its row: the sync's refresh and the user's Add review share it.
public static class PullRequestMirror
{
    public static void Mirror(PullRequest row, AdoPullRequest pr, AdoPullRequestDetails details)
    {
        row.RepoId = pr.RepoId;
        row.RepoName = pr.RepoName;
        row.Title = pr.Title;
        row.DescriptionMd = pr.Description;
        row.Author = pr.Author;
        row.SourceRef = pr.SourceRef;
        row.TargetRef = pr.TargetRef;
        row.SourceCommit = pr.SourceCommit!;
        row.TargetCommit = pr.TargetCommit;
        row.Iteration = details.Iteration;
        row.IsDraft = pr.IsDraft;
        row.WorkItemIds = JsonSerializer.Serialize(details.WorkItemIds);
        row.Url = pr.Url;
        row.IsListed = true;
        row.AdoCreatedAt = pr.CreatedAt is null ? null : DateTime.Parse(pr.CreatedAt, null, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);
        row.SyncedAt = DateTime.UtcNow;
    }
}
