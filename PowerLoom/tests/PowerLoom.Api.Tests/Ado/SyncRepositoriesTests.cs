using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncRepositories;
using PowerLoom.AdoIntegration.Features.SyncRepositories.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Ado;

[Collection(PowerLoomCollection.Name)]
public sealed class SyncRepositoriesTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task The_catalog_mirrors_the_enabled_repos_and_keeps_the_user_s_exclusions()
    {
        await ConfigureAdoAsync();
        await StoreRepoAsync("r-old", "OldName", excluded: true);
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.Repositories =
        [
            new AdoRepository("r-old", "PVS", "Proj", "https://x/_git/PVS", "refs/heads/development", false),
            new AdoRepository("r-new", "VAPI", "Proj", "https://x/_git/VAPI", null, false),
            new AdoRepository("r-off", "Disabled", "Proj", "https://x/_git/Disabled", null, true),
        ];

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new SyncRepositoriesRequest(PowerLoomHost.Vault)).ToUrl("/api/ado/repositories/sync");
            scenario.StatusCodeShouldBe(202);
        }));

        var repos = await LoadReposAsync();

        Assert.Equal(("PVS", true, "refs/heads/development"), (repos["r-old"].Name, repos["r-old"].Excluded, repos["r-old"].DefaultBranch));
        Assert.Equal(("VAPI", false), (repos["r-new"].Name, repos["r-new"].Excluded));
        Assert.DoesNotContain("r-off", repos.Keys);
    }

    private async Task ConfigureAdoAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<AdoSettingsStore>().SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "Proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
    }

    private async Task StoreRepoAsync(string id, string name, bool excluded)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (await db.Repos.AnyAsync(repo => repo.Id == id))
            return;

        db.Repos.Add(new Repo { Id = id, AdoProject = "Proj", Name = name, RemoteUrl = "https://x", Vault = PowerLoomHost.Vault, Excluded = excluded });
        await db.SaveChangesAsync();
    }

    private async Task<Dictionary<string, Repo>> LoadReposAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.Repos.AsNoTracking().Where(repo => repo.Vault == PowerLoomHost.Vault).ToDictionaryAsync(repo => repo.Id);
    }
}
