namespace PowerLoom.Features.WebSearch.Models;

public sealed record SaveWebSearchRequest(bool Enabled, string? Url, string? Language, int MaxSearchesPerRun, int MinSecondsBetweenSearches, int CacheHours);
