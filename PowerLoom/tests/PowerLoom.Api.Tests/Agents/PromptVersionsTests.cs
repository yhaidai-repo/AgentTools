using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Agents.PromptVersions.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Agents;

// An agent's prompt history through PowerLoom's API (user decision 2026-10-26): every edit a new version, a version
// number once, all of it gone with the agent.
[Collection(PowerLoomCollection.Name)]
public sealed class PromptVersionsTests(PowerLoomHost host)
{
    private const string Url = "/api/agents/prompt-history-test/prompt-versions";

    [Fact]
    public async Task Versions_are_added_once_each_and_removed_with_the_agent()
    {
        await host.Host.Scenario(scenario => scenario.Post.Json(new AddPromptVersionRequest(1, "First")).ToUrl(Url));
        await host.Host.Scenario(scenario => scenario.Post.Json(new AddPromptVersionRequest(2, "Second")).ToUrl(Url));
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddPromptVersionRequest(2, "Again")).ToUrl(Url);
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
        var kept = await TextsAsync();

        await host.Host.Scenario(scenario => scenario.Delete.Url(Url));

        Assert.Equal(["First", "Second"], kept);
        Assert.Empty(await TextsAsync());
    }

    private async Task<List<string>> TextsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().AgentPromptVersions.AsNoTracking().Where(row => row.AgentId == "prompt-history-test").OrderBy(row => row.Version).Select(row => row.Text).ToListAsync();
    }
}
