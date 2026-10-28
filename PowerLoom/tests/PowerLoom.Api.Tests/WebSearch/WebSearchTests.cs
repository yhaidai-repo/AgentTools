using System.Net;
using System.Text.Json;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.WebSearch;
using PowerLoom.Features.WebSearch.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.WebSearch;

[Collection(PowerLoomCollection.Name)]
public sealed class WebSearchTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string Path = "/api/web-search";

    public Task InitializeAsync() => ResetAsync();

    public Task DisposeAsync() => ResetAsync();

    [Fact]
    public async Task Web_search_is_off_with_the_compose_SearXNG_and_the_decided_pace_until_saved()
    {
        var setting = await host.Host.GetAsJson<WebSearchSetting>(Path);

        Assert.False(setting!.Enabled);
        Assert.Equal("http://searxng:8080", setting.Url);
        Assert.Equal("auto", setting.Language);
        Assert.Equal((20, 5, 24), (setting.MaxSearchesPerRun, setting.MinSecondsBetweenSearches, setting.CacheHours));
    }

    [Fact]
    public async Task A_saved_setting_is_stored_with_the_names_the_runner_reads()
    {
        var saved = await host.Host.PutJson(new SaveWebSearchRequest(true, " http://searxng:8080/ ", "uk-UA", 10, 3, 12), Path).Receive<WebSearchSetting>();
        var stored = await WithDbAsync(db => GlobalSettings.ReadRawAsync(db, WebSearchConnection.Key, CancellationToken.None));
        using var json = JsonDocument.Parse(stored!);
        var root = json.RootElement;

        Assert.Equal("http://searxng:8080", saved!.Url);
        Assert.True(root.GetProperty("enabled").GetBoolean());
        Assert.Equal("http://searxng:8080", root.GetProperty("url").GetString());
        Assert.Equal("uk-UA", root.GetProperty("language").GetString());
        Assert.Equal(10, root.GetProperty("maxSearchesPerRun").GetInt32());
        Assert.Equal(3, root.GetProperty("minSecondsBetweenSearches").GetInt32());
        Assert.Equal(12, root.GetProperty("cacheHours").GetInt32());
    }

    [Theory]
    [InlineData("searxng:8080", "uk-UA", 20, 5, 24, "SearXNG's address")]
    [InlineData("http://searxng:8080", "Ukrainian", 20, 5, 24, "language")]
    [InlineData("http://searxng:8080", "uk-UA", 0, 5, 24, "Searches per run")]
    [InlineData("http://searxng:8080", "uk-UA", 20, 61, 24, "Seconds between searches")]
    [InlineData("http://searxng:8080", "uk-UA", 20, 5, -1, "Cache hours")]
    public async Task A_broken_setting_is_refused(string url, string language, int perRun, int seconds, int cacheHours, string message)
    {
        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveWebSearchRequest(true, url, language, perRun, seconds, cacheHours)).ToUrl(Path);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        Assert.Contains(message, await refused.ReadAsTextAsync());
    }

    private Task ResetAsync() => WithDbAsync(db => GlobalSettings.DeleteAsync(db, WebSearchConnection.Key, CancellationToken.None));

    private async Task<T> WithDbAsync<T>(Func<PowerLoomDbContext, Task<T>> action)
    {
        using var scope = host.Host.Services.CreateScope();

        return await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }

    private async Task WithDbAsync(Func<PowerLoomDbContext, Task> action)
    {
        using var scope = host.Host.Services.CreateScope();

        await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }
}
