using Microsoft.EntityFrameworkCore;
using PowerLoom.GitHubIntegration.Features.SyncRepositories;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.GitHubIntegration.Scheduling;

// The per-vault GitHub schedules for the vaults whose GitHub is on: the repo catalog hourly (new repos show up).
public sealed class GitHubCronSource(IServiceScopeFactory scopes) : ICronSource
{
    private const string RepositoriesCron = "23 * * * *";

    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var settings = scope.ServiceProvider.GetRequiredService<GitHubSettingsStore>();
        var vaults = await db.Vaults.AsNoTracking().Select(vault => vault.Name).ToListAsync(cancellation);
        var entries = new List<CronEntry>();

        foreach (var vault in vaults)
            entries.AddRange(EntriesOf(vault, await settings.ReadAsync(vault, cancellation)));

        return entries;
    }

    private static IEnumerable<CronEntry> EntriesOf(string vault, GitHubSettings github)
    {
        if (!github.IsActive)
            return [];

        return [new CronEntry($"github-repositories:{vault}", RepositoriesCron, new SyncGitHubRepositories(vault))];
    }
}
