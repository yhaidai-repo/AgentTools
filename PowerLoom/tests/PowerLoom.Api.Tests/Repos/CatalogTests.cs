using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Repos;

[Collection(PowerLoomCollection.Name)]
public sealed class CatalogTests(PowerLoomHost host)
{
    [Fact]
    public async Task Local_repos_need_a_git_folder_in_the_root_and_ado_repos_keep_their_switch()
    {
        Directory.CreateDirectory(Path.Combine(host.ReposRoot, "Tools", ".git"));
        await SeedAdoRepoAsync("r-cat", "Catalog");

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddLocalRepoRequest("Missing")).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/repos/local");
            scenario.StatusCodeShouldBe(400);
        });
        var added = await host.Host.PostJson(new AddLocalRepoRequest("Tools"), $"/api/vaults/{PowerLoomHost.Vault}/repos/local").Receive<RepoSummary>();

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(false)).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/repos/r-cat/enabled");
            scenario.StatusCodeShouldBeOk();
        });

        var repos = await LoadAsync();

        Assert.Contains("isn't a git repository", await refused.ReadAsTextAsync());
        Assert.Equal(($"local:{PowerLoomHost.Vault}:Tools", RepoKind.Local), (added!.Id, repos[added.Id].Kind));
        Assert.True(repos["r-cat"].Excluded);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/vaults/{PowerLoomHost.Vault}/repos/{added.Id}");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.DoesNotContain(added.Id, (await LoadAsync()).Keys);
    }

    private async Task SeedAdoRepoAsync(string id, string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (await db.Repos.AnyAsync(repo => repo.Id == id))
            return;

        db.Repos.Add(new Repo { Id = id, AdoProject = "Proj", Name = name, RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task A_GitHub_repo_s_switch_finds_it_by_its_id_sent_as_the_web_sends_it()
    {
        const string id = "github:test-vault:koffcheg/switch-app";

        await SeedAsync(new Repo { Id = id, AdoProject = "koffcheg", Name = "switch-app", RemoteUrl = "https://github.com/koffcheg/switch-app.git", Kind = RepoKind.Github, Vault = PowerLoomHost.Vault });

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(false)).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/repos/{Uri.EscapeDataString(id)}/enabled");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.True((await LoadAsync())[id].Excluded);
    }

    private async Task SeedAsync(Repo repo)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (!await db.Repos.AnyAsync(row => row.Id == repo.Id))
            db.Repos.Add(repo);

        await db.SaveChangesAsync();
    }

    private async Task<Dictionary<string, Repo>> LoadAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Repos.AsNoTracking().Where(repo => repo.Vault == PowerLoomHost.Vault).ToDictionaryAsync(repo => repo.Id);
    }
}
