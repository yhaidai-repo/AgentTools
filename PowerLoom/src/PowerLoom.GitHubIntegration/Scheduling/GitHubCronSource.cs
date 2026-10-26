using Microsoft.EntityFrameworkCore;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Features.SyncRepositories;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.GitHubIntegration.Scheduling;

// The per-vault GitHub schedules for the vaults whose GitHub is on: the repo catalog hourly (new repos show up), and the
// pull request check on the Pull requests card's cron while that card is on (shared with Azure DevOps).
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
            entries.AddRange(await EntriesOfAsync(db, vault, await settings.ReadAsync(vault, cancellation), cancellation));

        return entries;
    }

    private static async Task<IReadOnlyList<CronEntry>> EntriesOfAsync(PowerLoomDbContext db, string vault, GitHubSettings github, CancellationToken cancellation)
    {
        if (!github.IsActive)
            return [];

        var repositories = new CronEntry($"github-repositories:{vault}", RepositoriesCron, new SyncGitHubRepositories(vault));

        if (!await VaultFeatures.IsOnAsync(db, vault, VaultFeatures.PullRequests, cancellation))
            return [repositories];

        return [repositories, new CronEntry($"github-pull-requests:{vault}", (await PullRequestSettings.ReadAsync(db, vault, cancellation)).Cron, new SyncGitHubPullRequests(vault))];
    }
}
