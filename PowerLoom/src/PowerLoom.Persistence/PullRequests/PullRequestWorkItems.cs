using System.Text.Json;

namespace PowerLoom.Persistence.PullRequests;

// `pull_request.work_item_ids`: the ADO ids the pull request links, as a JSON list.
public static class PullRequestWorkItems
{
    public static List<int> Parse(string workItemIds) => JsonSerializer.Deserialize<List<int>>(workItemIds) ?? [];
}
