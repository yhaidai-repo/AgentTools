using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Client;

public sealed class AdoClient(HttpClient http, AdoConnection connection) : IAdoClient
{
    private const string ApiVersion = "api-version=7.1";
    // Work item comments have no released 7.1 version yet.
    private const string CommentsApiVersion = "api-version=7.1-preview.4";
    private const int BatchLimit = 200;
    private const int PullRequestPage = 100;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly string _orgUrl = connection.OrgUrl.TrimEnd('/');

    public async Task<IReadOnlyList<int>> QueryIdsAsync(string wiql, CancellationToken cancellation)
    {
        var body = await RequestAsync<WiqlResult>($"{ProjectUrl()}/_apis/wit/wiql?{ApiVersion}", new { query = wiql }, cancellation);

        return body.WorkItems.Select(item => item.Id).ToList();
    }

    public async Task<IReadOnlyList<AdoWorkItem>> GetWorkItemsAsync(IReadOnlyList<int> ids, IReadOnlyList<string>? fields, CancellationToken cancellation)
    {
        var items = new List<AdoWorkItem>();

        foreach (var batch in ids.Chunk(BatchLimit))
            items.AddRange(await GetWorkItemBatchAsync(batch, fields, cancellation));

        return items;
    }

    public async Task<IReadOnlyList<AdoComment>> GetCommentsAsync(int workItemId, int top, CancellationToken cancellation)
    {
        var url = $"{ProjectUrl()}/_apis/wit/workItems/{workItemId}/comments?$top={top}&order=desc&{CommentsApiVersion}";
        var body = await RequestAsync<CommentListDto>(url, null, cancellation);

        return body.Comments.Select(ToComment).Reverse().ToList();
    }

    public async Task<IReadOnlyList<AdoIteration>> GetIterationsAsync(bool onlyCurrent, CancellationToken cancellation)
    {
        var filter = onlyCurrent ? "$timeframe=current&" : "";
        var url = $"{ProjectUrl()}/{Uri.EscapeDataString(connection.Team)}/_apis/work/teamsettings/iterations?{filter}{ApiVersion}";
        var body = await RequestAsync<ValueList<IterationDto>>(url, null, cancellation);

        return body.Value.Select(dto => new AdoIteration(dto.Id, dto.Name, dto.Path, dto.Attributes?.StartDate, dto.Attributes?.FinishDate, dto.Attributes?.TimeFrame)).ToList();
    }

    public async Task<IReadOnlyList<AdoRepository>> ListRepositoriesAsync(CancellationToken cancellation)
    {
        var body = await RequestAsync<ValueList<RepositoryDto>>($"{_orgUrl}/_apis/git/repositories?{ApiVersion}", null, cancellation);

        return body.Value.Select(dto => new AdoRepository(dto.Id, dto.Name, dto.Project.Name, dto.RemoteUrl, dto.DefaultBranch, dto.IsDisabled ?? false)).ToList();
    }

    // Page by page: ADO returns at most a page per call.
    public async Task<IReadOnlyList<AdoPullRequest>> ListActivePullRequestsAsync(CancellationToken cancellation)
    {
        var pullRequests = new List<AdoPullRequest>();
        List<PullRequestDto> page;

        do
        {
            var url = $"{ProjectUrl()}/_apis/git/pullrequests?searchCriteria.status=active&$top={PullRequestPage}&$skip={pullRequests.Count}&{ApiVersion}";

            page = (await RequestAsync<ValueList<PullRequestDto>>(url, null, cancellation)).Value;
            pullRequests.AddRange(page.Select(ToPullRequest));
        }
        while (page.Count == PullRequestPage);

        return pullRequests;
    }

    public async Task<AdoPullRequestDetails> GetPullRequestDetailsAsync(string repoId, int pullRequestId, CancellationToken cancellation)
    {
        var baseUrl = $"{ProjectUrl()}/_apis/git/repositories/{repoId}/pullRequests/{pullRequestId}";
        var iterations = await RequestAsync<ValueList<IdDto>>($"{baseUrl}/iterations?{ApiVersion}", null, cancellation);
        var workItems = await RequestAsync<ValueList<StringIdDto>>($"{baseUrl}/workitems?{ApiVersion}", null, cancellation);
        var ids = workItems.Value.Select(item => int.TryParse(item.Id, out var id) ? id : (int?)null).Where(id => id is not null).Select(id => id!.Value).ToList();

        return new AdoPullRequestDetails(Math.Max(1, iterations.Value.Select(iteration => iteration.Id).DefaultIfEmpty(1).Max()), ids);
    }

    private async Task<IReadOnlyList<AdoWorkItem>> GetWorkItemBatchAsync(int[] ids, IReadOnlyList<string>? fields, CancellationToken cancellation)
    {
        var body = await RequestAsync<ValueList<AdoWorkItem?>>($"{ProjectUrl()}/_apis/wit/workitemsbatch?{ApiVersion}", BatchBody(ids, fields), cancellation);

        return body.Value.Where(item => item is not null).Select(item => item!).ToList();
    }

    // Omit: items deleted in ADO come back as null instead of failing the whole batch. ADO takes either a field list or
    // `$expand=fields` (every field), not both.
    private static Dictionary<string, object> BatchBody(int[] ids, IReadOnlyList<string>? fields)
    {
        var body = new Dictionary<string, object> { ["ids"] = ids, ["errorPolicy"] = "Omit" };

        if (fields is null)
        {
            body["$expand"] = "fields";
        }
        else
        {
            body["fields"] = fields;
        }

        return body;
    }

    private static AdoComment ToComment(CommentDto dto)
    {
        return new AdoComment(dto.CreatedBy?.DisplayName ?? dto.CreatedBy?.UniqueName, dto.CreatedDate, dto.Text ?? "");
    }

    private AdoPullRequest ToPullRequest(PullRequestDto dto)
    {
        var reviewers = (dto.Reviewers ?? []).Where(reviewer => reviewer.IsContainer != true && !string.IsNullOrEmpty(reviewer.UniqueName)).Select(reviewer => reviewer.UniqueName!).ToList();

        return new AdoPullRequest(dto.PullRequestId, dto.Repository.Id, dto.Repository.Name, dto.Title, dto.Description, dto.IsDraft ?? false,
            dto.CreatedBy?.UniqueName ?? dto.CreatedBy?.DisplayName, dto.SourceRefName, dto.TargetRefName, dto.LastMergeSourceCommit?.CommitId,
            dto.LastMergeTargetCommit?.CommitId, reviewers, dto.CreationDate, $"{ProjectUrl()}/_git/{Uri.EscapeDataString(dto.Repository.Name)}/pullrequest/{dto.PullRequestId}");
    }

    public async Task<AdoDownload> DownloadAttachmentAsync(string url, CancellationToken cancellation)
    {
        if (!url.StartsWith($"{_orgUrl}/", StringComparison.OrdinalIgnoreCase))
            throw new AdoRequestException(400, $"not an attachment of {_orgUrl}: {url}");

        using var request = new HttpRequestMessage(HttpMethod.Get, url);

        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($":{connection.Pat}")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("*/*"));

        using var response = await http.SendAsync(request, cancellation);
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";

        // An expired token answers with the HTML sign-in page instead of the file.
        if (!response.IsSuccessStatusCode || contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase))
            throw new AdoRequestException((int)response.StatusCode, $"download failed ({(int)response.StatusCode} {contentType}): {url}");

        var fileName = System.Web.HttpUtility.ParseQueryString(new Uri(url).Query).Get("fileName") ?? "attachment";

        return new AdoDownload(fileName, contentType, await response.Content.ReadAsByteArrayAsync(cancellation));
    }

    private string ProjectUrl() => $"{_orgUrl}/{Uri.EscapeDataString(connection.Project)}";

    private async Task<T> RequestAsync<T>(string url, object? body, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, url);

        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($":{connection.Pat}")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (body is not null)
            request.Content = JsonContent.Create(body, options: Json);

        using var response = await http.SendAsync(request, cancellation);

        await EnsureJsonSuccessAsync(response, cancellation);

        return await response.Content.ReadFromJsonAsync<T>(Json, cancellation) ?? throw new AdoRequestException((int)response.StatusCode, "Azure DevOps returned an empty answer");
    }

    // A bad or expired PAT often returns an HTML sign-in page with 200/203 instead of 401.
    private static async Task EnsureJsonSuccessAsync(HttpResponseMessage response, CancellationToken cancellation)
    {
        var isJson = response.Content.Headers.ContentType?.MediaType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) ?? false;

        if (response.IsSuccessStatusCode && isJson)
            return;

        if (!isJson)
            throw new AdoRequestException((int)response.StatusCode, "Azure DevOps did not return JSON: check the token and the organization URL");

        var detail = await response.Content.ReadFromJsonAsync<ErrorDto>(Json, cancellation);

        throw new AdoRequestException((int)response.StatusCode, detail?.Message ?? $"Azure DevOps request failed ({(int)response.StatusCode})");
    }

    private sealed record WiqlResult(List<IdDto> WorkItems);

    private sealed record ValueList<T>(List<T> Value);

    private sealed record IdDto(int Id);

    private sealed record StringIdDto(string Id);

    private sealed record ErrorDto(string? Message);

    private sealed record IterationDto(string Id, string Name, string Path, IterationAttributesDto? Attributes);

    private sealed record IterationAttributesDto(string? StartDate, string? FinishDate, string? TimeFrame);

    private sealed record RepositoryDto(string Id, string Name, string RemoteUrl, string? DefaultBranch, bool? IsDisabled, ProjectDto Project);

    private sealed record ProjectDto(string Name);

    private sealed record PullRequestDto(int PullRequestId, string Title, string? Description, bool? IsDraft, string? CreationDate, string SourceRefName, string TargetRefName,
        IdentityDto? CreatedBy, RepositoryRefDto Repository, CommitDto? LastMergeSourceCommit, CommitDto? LastMergeTargetCommit, List<ReviewerDto>? Reviewers);

    private sealed record IdentityDto(string? UniqueName, string? DisplayName);

    private sealed record RepositoryRefDto(string Id, string Name);

    private sealed record CommitDto(string CommitId);

    private sealed record ReviewerDto(string? UniqueName, bool? IsContainer);
}
