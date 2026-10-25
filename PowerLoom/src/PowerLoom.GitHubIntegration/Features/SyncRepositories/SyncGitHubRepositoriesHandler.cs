using Microsoft.EntityFrameworkCore;
using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Client.Models;
using PowerLoom.GitHubIntegration.Features.Connection;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.GitHubIntegration.Features.SyncRepositories;

// The catalog mirrors the owner's GitHub repos (archived ones too: their code still answers questions); `excluded`
// (the user's enable switch) is never overwritten. A repo whose name another repo of the vault has already is left out:
// agents and chats name repos by name.
public static class SyncGitHubRepositoriesHandler
{
    public static async Task Handle(SyncGitHubRepositories message, GitHubSettingsStore settings, IGitHubClientFactory clients, PowerLoomDbContext db, ILogger<SyncGitHubRepositories> logger, CancellationToken cancellation)
    {
        var github = await settings.ReadAsync(message.Vault, cancellation);

        if (!github.IsActive)
        {
            logger.LogInformation("github repositories {Vault}: GitHub is off or has no token", message.Vault);

            return;
        }

        var repositories = (await clients.For(github.Token).ListRepositoriesAsync(cancellation)).Where(repo => GitHubConnection.IsOwned(repo.Owner, github.Owner)).ToList();
        var taken = await NamesOfOtherReposAsync(db, message.Vault, cancellation);
        var listed = repositories.Where(repo => !taken.Contains(repo.Name)).ToList();

        foreach (var repository in listed)
            await UpsertAsync(db, message.Vault, repository, cancellation);

        await db.SaveChangesAsync(cancellation);
        logger.LogInformation("github repositories {Vault}: {Count} repos, {Skipped} left out (name taken)", message.Vault, listed.Count, repositories.Count - listed.Count);
    }

    public static string IdOf(string vault, GitHubRepository repository) => $"github:{vault}:{repository.Owner}/{repository.Name}".ToLowerInvariant();

    private static async Task<HashSet<string>> NamesOfOtherReposAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        var names = await db.Repos.AsNoTracking().Where(repo => repo.Vault == vault && repo.Kind != RepoKind.Github).Select(repo => repo.Name).ToListAsync(cancellation);

        return names.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static async Task UpsertAsync(PowerLoomDbContext db, string vault, GitHubRepository repository, CancellationToken cancellation)
    {
        var id = IdOf(vault, repository);
        var row = await db.Repos.FindAsync([id], cancellation);

        if (row is null)
            db.Repos.Add(row = new Repo { Id = id, Vault = vault, Kind = RepoKind.Github, AdoProject = "", Name = "", RemoteUrl = "" });

        row.AdoProject = repository.Owner;
        row.Name = repository.Name;
        row.RemoteUrl = repository.CloneUrl;
        row.DefaultBranch = repository.DefaultBranch;
        row.SyncedAt = DateTime.UtcNow;
    }
}
