using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.GitHubIntegration.Client.Models;
using PowerLoom.GitHubIntegration.Features.Connection.Models;
using PowerLoom.GitHubIntegration.Features.SyncRepositories;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.GitHub;

// Settings → Repositories → GitHub (user decision 2026-10-25): a token per vault, the owner's repos in the catalog.
[Collection(PowerLoomCollection.Name)]
public sealed class GitHubConnectionTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private FakeGitHubClient GitHub => host.Host.Services.GetRequiredService<FakeGitHubClientFactory>().Client;

    [Fact]
    public async Task A_token_GitHub_refuses_is_not_saved()
    {
        GitHub.BadTokens.Add("bad-token");

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveGitHubRequest(true, "bad-token", null)).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/github");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        Assert.Contains("GitHub refused the token", await refused.ReadAsTextAsync());
    }

    [Fact]
    public async Task Saving_lists_the_owner_s_repos_and_a_resync_keeps_the_user_s_switch_and_other_repos_names()
    {
        GitHub.Login = "sam";
        GitHub.Repositories = [Repo("acme", "gh-shop", "main"), Repo("acme", "gh-taken", "main"), Repo("someone", "gh-other", "dev")];
        await SeedTakenNameAsync("gh-taken");

        var (summary, _) = await SaveAsync(new SaveGitHubRequest(true, "good-token", "acme"));
        await SetExcludedAsync("github:test-vault:acme/gh-shop");
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncGitHubRepositories(PowerLoomHost.Vault)).AsTask());
        var repos = await GitHubReposAsync();
        var shop = Assert.Single(repos);

        Assert.Equal(new GitHubSummary(true, "acme", "sam", true), summary);
        Assert.Equal(("github:test-vault:acme/gh-shop", RepoKind.Github, "acme", "https://github.com/acme/gh-shop.git", "main"), (shop.Id, shop.Kind, shop.AdoProject, shop.RemoteUrl, shop.DefaultBranch));
        Assert.True(shop.Excluded);
    }

    [Fact]
    public async Task The_test_says_who_the_token_is_and_how_many_repos_it_reads()
    {
        GitHub.Login = "sam";
        GitHub.Repositories = [Repo("acme", "gh-a", "main"), Repo("acme", "gh-b", "main"), Repo("else", "gh-c", "main")];

        var check = await host.Host.PostJson(new TestGitHubRequest("good-token", "acme"), $"/api/vaults/{PowerLoomHost.Vault}/github/test").Receive<GitHubCheck>();

        Assert.Equal(new GitHubCheck(true, "Signed in as sam: 2 repos of acme."), check);
    }

    private static GitHubRepository Repo(string owner, string name, string branch) => new(owner, name, $"https://github.com/{owner}/{name}.git", branch, false);

    private async Task<(GitHubSummary?, ITrackedSession)> SaveAsync(SaveGitHubRequest request)
    {
        GitHubSummary? summary = null;
        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ =>
        {
            summary = await host.Host.PutJson(request, $"/api/vaults/{PowerLoomHost.Vault}/github").Receive<GitHubSummary>();
        }));

        return (summary, session);
    }

    private async Task SeedTakenNameAsync(string name)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (!await db.Repos.AnyAsync(repo => repo.Name == name))
            db.Repos.Add(new Repo { Id = $"local:{PowerLoomHost.Vault}:{name}", Vault = PowerLoomHost.Vault, Kind = RepoKind.Local, AdoProject = "", Name = name, RemoteUrl = $"/repos/{name}" });

        await db.SaveChangesAsync();
    }

    private async Task SetExcludedAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Repos.Where(repo => repo.Id == id).ExecuteUpdateAsync(set => set.SetProperty(repo => repo.Excluded, true));
    }

    private async Task<List<Repo>> GitHubReposAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Repos.AsNoTracking().Where(repo => repo.Kind == RepoKind.Github && repo.AdoProject == "acme").ToListAsync();
    }
}
