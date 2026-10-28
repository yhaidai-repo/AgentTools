using System.Text.RegularExpressions;
using PowerLoom.Contracts;
using PowerLoom.Features.WebSearch.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.WebSearch;

// Settings → Data access → Web search (user decision 2026-10-28): one self-hosted SearXNG for the whole PowerLoom and
// the pace agents search at. No secret: SearXNG is reachable only on Docker's network. The agent-runner reads it for
// every run.
public sealed partial class WebSearchConnection(PowerLoomDbContext db)
{
    // The TypeScript side reads the same key (WEB_SEARCH_KEY).
    public const string Key = "webSearch";

    // Runs used 3 searches at most (data access log, October 2026): these bounds only keep a typo from breaking runs.
    private const int MaxSearchesPerRunLimit = 100;
    private const int MaxSecondsBetweenSearches = 60;
    private const int MaxCacheHours = 168;

    public async Task<WebSearchSetting> ReadAsync(CancellationToken cancellation)
    {
        return await GlobalSettings.ReadAsync<WebSearchSetting>(db, Key, cancellation) ?? new WebSearchSetting();
    }

    public async Task<Outcome<WebSearchSetting>> SaveAsync(SaveWebSearchRequest request, CancellationToken cancellation)
    {
        var setting = SettingOf(request);
        var problem = ProblemWith(setting);

        if (problem is not null)
            return Outcome<WebSearchSetting>.Failure(Problem.Invalid(problem));

        await GlobalSettings.SaveAsync(db, Key, setting, cancellation);

        return Outcome<WebSearchSetting>.Success(setting);
    }

    private static WebSearchSetting SettingOf(SaveWebSearchRequest request) => new()
    {
        Enabled = request.Enabled,
        Url = request.Url?.Trim().TrimEnd('/') ?? "",
        Language = request.Language?.Trim() ?? "",
        MaxSearchesPerRun = request.MaxSearchesPerRun,
        MinSecondsBetweenSearches = request.MinSecondsBetweenSearches,
        CacheHours = request.CacheHours,
    };

    private static string? ProblemWith(WebSearchSetting setting)
    {
        if (!IsHttpUrl(setting.Url))
            return $"Give SearXNG's address, e.g. {WebSearchSetting.DefaultUrl}.";

        if (!LanguagePattern().IsMatch(setting.Language))
            return "Give a language such as uk-UA, en, auto or all.";

        if (setting.MaxSearchesPerRun is < 1 or > MaxSearchesPerRunLimit)
            return $"Searches per run must be 1–{MaxSearchesPerRunLimit}.";

        if (setting.MinSecondsBetweenSearches is < 0 or > MaxSecondsBetweenSearches)
            return $"Seconds between searches must be 0–{MaxSecondsBetweenSearches}.";

        return setting.CacheHours is < 0 or > MaxCacheHours ? $"Cache hours must be 0–{MaxCacheHours}." : null;
    }

    private static bool IsHttpUrl(string url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    [GeneratedRegex("^(auto|all|[a-z]{2,3}(-[A-Za-z]{2,4})?)$")]
    private static partial Regex LanguagePattern();
}
