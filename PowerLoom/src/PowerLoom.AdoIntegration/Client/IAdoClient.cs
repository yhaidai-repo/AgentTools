using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Client;

// Read-only Azure DevOps REST client. Never add write calls: PowerLoom is local-only.
public interface IAdoClient
{
    Task<IReadOnlyList<int>> QueryIdsAsync(string wiql, CancellationToken cancellation);

    // `fields` null (AdoFields.Every): every field and link each work item has.
    Task<IReadOnlyList<AdoWorkItem>> GetWorkItemsAsync(IReadOnlyList<int> ids, IReadOnlyList<string>? fields, CancellationToken cancellation);

    // The newest `top` comments of a work item's discussion, oldest of them first.
    Task<IReadOnlyList<AdoComment>> GetCommentsAsync(int workItemId, int top, CancellationToken cancellation);

    // ADO only accepts `current` as a timeframe filter; without it, all team iterations are returned.
    Task<IReadOnlyList<AdoIteration>> GetIterationsAsync(bool onlyCurrent, CancellationToken cancellation);

    Task<IReadOnlyList<AdoRepository>> ListRepositoriesAsync(CancellationToken cancellation);

    // Every active pull request of the project.
    Task<IReadOnlyList<AdoPullRequest>> ListActivePullRequestsAsync(CancellationToken cancellation);

    Task<AdoPullRequestDetails> GetPullRequestDetailsAsync(string repoId, int pullRequestId, CancellationToken cancellation);

    // A work item attachment (an `_apis/wit/attachments` link in a PBI), fetched with the vault's token.
    Task<AdoDownload> DownloadAttachmentAsync(string url, CancellationToken cancellation);
}
