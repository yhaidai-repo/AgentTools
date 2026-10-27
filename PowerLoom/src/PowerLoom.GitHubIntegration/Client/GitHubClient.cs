using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using PowerLoom.GitHubIntegration.Client.Models;

namespace PowerLoom.GitHubIntegration.Client;

// GitHub's REST API with a personal access token; list calls page through 100 at a time, up to MaxPages.
public sealed class GitHubClient(HttpClient http, string token) : IGitHubClient
{
    private const string Api = "https://api.github.com";
    private const int PageSize = 100;
    private const int MaxPages = 20;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public async Task<string> GetLoginAsync(CancellationToken cancellation) => (await RequestAsync<UserDto>($"{Api}/user", cancellation)).Login;

    public async Task<IReadOnlyList<GitHubRepository>> ListRepositoriesAsync(CancellationToken cancellation)
    {
        var repos = await PagesAsync<RepositoryDto>($"{Api}/user/repos?affiliation=owner,collaborator,organization_member&sort=full_name", cancellation);

        return repos.Where(dto => !dto.Disabled).Select(dto => new GitHubRepository(dto.Owner.Login, dto.Name, dto.CloneUrl, dto.DefaultBranch, dto.Archived)).ToList();
    }

    public async Task<IReadOnlyList<GitHubPullRequest>> ListOpenPullRequestsAsync(string owner, string repo, CancellationToken cancellation)
    {
        var pulls = await PagesAsync<PullDto>($"{Api}/repos/{Uri.EscapeDataString(owner)}/{Uri.EscapeDataString(repo)}/pulls?state=open", cancellation);

        return pulls.Select(dto => ToPullRequest(owner, repo, dto)).ToList();
    }

    public async Task<IReadOnlyList<string>> ListReviewedPullRequestsAsync(string login, CancellationToken cancellation)
    {
        var query = Uri.EscapeDataString($"is:pr is:open reviewed-by:{login}");
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int? expected = null;
        for (var page = 1; page <= 10; page++)
        {
            var found = await RequestAsync<SearchDto>($"{Api}/search/issues?q={query}&per_page={PageSize}&page={page}", cancellation);
            // Search exposes at most 1,000 results. Never treat a partial set as authoritative for unlisting.
            if (found.TotalCount is not { } total || found.IncompleteResults is not false || found.Items is null || total < 0 || total > 1000 || expected is not null && expected != total)
                throw new GitHubRequestException(502, "GitHub reviewed search is incomplete; sync was stopped before unlisting");
            expected = total;
            var before = keys.Count;
            foreach (var item in found.Items)
            {
                var key = KeyOf(item.RepositoryUrl, item.Number) ?? throw new GitHubRequestException(502, "GitHub reviewed search returned an invalid repository");
                keys.Add(key);
            }
            if (keys.Count == expected) return keys.ToList();
            if (keys.Count > expected || keys.Count == before || found.Items.Count < PageSize)
                throw new GitHubRequestException(502, "GitHub reviewed search ended before all results were received");
        }
        throw new GitHubRequestException(502, "GitHub reviewed search exceeded its result limit");
    }

    private static GitHubPullRequest ToPullRequest(string owner, string repo, PullDto dto)
    {
        var reviewers = dto.RequestedReviewers?.Select(reviewer => reviewer.Login).ToList() ?? [];

        return new GitHubPullRequest(owner, repo, dto.Number, dto.Title, dto.Body, dto.User.Login, dto.Head.Ref, dto.Head.Sha, dto.Base.Ref, dto.Base.Sha, dto.Draft, reviewers, dto.CreatedAt, dto.HtmlUrl);
    }

    // `https://api.github.com/repos/<owner>/<repo>` and the number.
    private static string? KeyOf(string repositoryUrl, int number)
    {
        var parts = repositoryUrl.Split('/', StringSplitOptions.RemoveEmptyEntries);

        return parts.Length >= 2 ? GitHubPullRequestKey.Of(parts[^2], parts[^1], number) : null;
    }

    private async Task<List<T>> PagesAsync<T>(string url, CancellationToken cancellation)
    {
        var all = new List<T>();
        var separator = url.Contains('?') ? '&' : '?';

        for (var page = 1; page <= MaxPages; page++)
        {
            var batch = await RequestAsync<List<T>>($"{url}{separator}per_page={PageSize}&page={page}", cancellation);

            all.AddRange(batch);

            if (batch.Count < PageSize)
                return all;
        }

        // A full last page proves neither completion nor truncation. One bounded lookahead distinguishes them.
        var remaining = await RequestAsync<List<T>>($"{url}{separator}per_page={PageSize}&page={MaxPages + 1}", cancellation);
        if (remaining.Count > 0)
            throw new GitHubRequestException(502, "GitHub list is incomplete at its pagination limit; sync was stopped before unlisting");

        return all;
    }

    private async Task<T> RequestAsync<T>(string url, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.UserAgent.Add(new ProductInfoHeaderValue("PowerLoom", "1.0"));
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");

        using var response = await http.SendAsync(request, cancellation);

        if (!response.IsSuccessStatusCode)
            throw new GitHubRequestException((int)response.StatusCode, $"GitHub answered {(int)response.StatusCode} for {new Uri(url).AbsolutePath}: {await MessageOfAsync(response, cancellation)}");

        return await response.Content.ReadFromJsonAsync<T>(Json, cancellation) ?? throw new GitHubRequestException((int)response.StatusCode, "GitHub returned an empty answer");
    }

    private static async Task<string> MessageOfAsync(HttpResponseMessage response, CancellationToken cancellation)
    {
        var text = await response.Content.ReadAsStringAsync(cancellation);

        return text.Length > 300 ? text[..300] : text;
    }

    private sealed record UserDto(string Login);

    private sealed record OwnerDto(string Login);

    private sealed record RepositoryDto(string Name, OwnerDto Owner, string CloneUrl, string? DefaultBranch, bool Archived, bool Disabled);

    private sealed record BranchDto(string Ref, string Sha);

    private sealed record PullDto(int Number, string Title, string? Body, UserDto User, BranchDto Head, BranchDto Base, bool Draft, List<UserDto>? RequestedReviewers, DateTime CreatedAt, string HtmlUrl);

    private sealed record SearchItemDto(int Number, string RepositoryUrl);

    private sealed record SearchDto(List<SearchItemDto>? Items, int? TotalCount, bool? IncompleteResults);
}
