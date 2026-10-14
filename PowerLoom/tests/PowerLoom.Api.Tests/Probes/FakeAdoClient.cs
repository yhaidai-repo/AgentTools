using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// Azure DevOps as the tests need it: a current sprint, a few ids, and whatever a test puts into the lists.
public sealed class FakeAdoClient : IAdoClient
{
    public AdoIteration? CurrentSprint { get; set; } = new("it-7", "Sprint 7", "proj\\Sprint 7", null, null, "current");

    public List<int> QueryResult { get; set; } = [1, 2, 3];

    public List<string> Queries { get; } = [];

    public List<AdoWorkItem> WorkItems { get; set; } = [];

    public List<AdoRepository> Repositories { get; set; } = [];

    public List<AdoPullRequest> PullRequests { get; set; } = [];

    public Dictionary<int, AdoPullRequestDetails> Details { get; } = [];

    // Work item id â†’ its discussion, oldest first.
    public Dictionary<int, List<AdoComment>> Comments { get; } = [];

    // Attachment URL → file; a URL not listed fails like an expired token would.
    public Dictionary<string, AdoDownload> Downloads { get; } = [];

    public Task<IReadOnlyList<int>> QueryIdsAsync(string wiql, CancellationToken cancellation)
    {
        Queries.Add(wiql);

        return Task.FromResult<IReadOnlyList<int>>(QueryResult);
    }

    public Task<IReadOnlyList<AdoWorkItem>> GetWorkItemsAsync(IReadOnlyList<int> ids, IReadOnlyList<string> fields, CancellationToken cancellation)
    {
        return Task.FromResult<IReadOnlyList<AdoWorkItem>>(WorkItems.Where(item => ids.Contains(item.Id)).ToList());
    }

    public Task<IReadOnlyList<AdoComment>> GetCommentsAsync(int workItemId, int top, CancellationToken cancellation)
    {
        var comments = Comments.GetValueOrDefault(workItemId, []);

        return Task.FromResult<IReadOnlyList<AdoComment>>(comments.TakeLast(top).ToList());
    }

    public Task<IReadOnlyList<AdoIteration>> GetIterationsAsync(bool onlyCurrent, CancellationToken cancellation)
    {
        return Task.FromResult<IReadOnlyList<AdoIteration>>(CurrentSprint is null ? [] : [CurrentSprint]);
    }

    public Task<IReadOnlyList<AdoRepository>> ListRepositoriesAsync(CancellationToken cancellation) => Task.FromResult<IReadOnlyList<AdoRepository>>(Repositories);

    public Task<IReadOnlyList<AdoPullRequest>> ListActivePullRequestsAsync(CancellationToken cancellation) => Task.FromResult<IReadOnlyList<AdoPullRequest>>(PullRequests);

    public Task<AdoPullRequestDetails> GetPullRequestDetailsAsync(string repoId, int pullRequestId, CancellationToken cancellation)
    {
        return Task.FromResult(Details.GetValueOrDefault(pullRequestId, new AdoPullRequestDetails(1, [])));
    }

    public Task<AdoDownload> DownloadAttachmentAsync(string url, CancellationToken cancellation)
    {
        return Downloads.TryGetValue(url, out var file) ? Task.FromResult(file) : throw new AdoRequestException(203, $"download failed (203 text/html): {url}");
    }
}
