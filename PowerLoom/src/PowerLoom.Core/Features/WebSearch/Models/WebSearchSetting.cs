namespace PowerLoom.Features.WebSearch.Models;

// The stored `webSearch` row, read by the agent-runner (WebSearchSettings); the defaults match the TypeScript side's.
public sealed class WebSearchSetting
{
    // SearXNG as the compose service `searxng` serves it to the other containers.
    public const string DefaultUrl = "http://searxng:8080";

    public bool Enabled { get; set; }

    public string Url { get; set; } = DefaultUrl;

    // SearXNG's `language`, e.g. uk-UA; the page fills it from the machine's locale.
    public string Language { get; set; } = "auto";

    public int MaxSearchesPerRun { get; set; } = 20;

    public int MinSecondsBetweenSearches { get; set; } = 5;

    public int CacheHours { get; set; } = 24;
}
