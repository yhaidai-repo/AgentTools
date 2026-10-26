using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.AdoIntegration.Features.Settings.Models;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Scheduling;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.GitHub;

// Settings → Sync → Pull requests (user decision 2026-10-26: one card for Azure DevOps and GitHub): GitHub's check runs on
// the card's switch and schedule, and records how the last check went.
[Collection(PowerLoomCollection.Name)]
public sealed class GitHubPullRequestSyncSettingsTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private static readonly string Url = $"/api/vaults/{PowerLoomHost.Vault}/ado/pull-request-settings";

    private FakeGitHubClient GitHub => host.Host.Services.GetRequiredService<FakeGitHubClientFactory>().Client;

    [Fact]
    public async Task The_check_runs_on_the_pull_requests_card_s_switch_and_schedule()
    {
        await ConnectAsync();

        await host.Host.PutJson(new PullRequestSettingsRequest(false, "*/10 * * * *", 50, null), Url).Receive<SavedSettings>();
        var off = await EntriesAsync();
        await host.Host.PutJson(new PullRequestSettingsRequest(true, "*/10 * * * *", 50, null), Url).Receive<SavedSettings>();
        var on = await EntriesAsync();

        Assert.DoesNotContain(off, entry => entry.Key.StartsWith("github-pull-requests:"));
        Assert.Contains(on, entry => entry.Key == $"github-pull-requests:{PowerLoomHost.Vault}" && entry.Cron == "*/10 * * * *");
    }

    [Fact]
    public async Task Each_check_records_what_it_found_or_why_GitHub_refused()
    {
        await ConnectAsync();
        GitHub.Token = "good-token";

        await CheckAsync();
        var found = await StatusAsync();
        GitHub.BadTokens.Add("good-token");
        await CheckAsync();
        var refused = await StatusAsync();
        GitHub.BadTokens.Remove("good-token");

        Assert.Contains("GitHub PR(s) you review or wrote", found!.Summary);
        Assert.Null(found.Error);
        Assert.Contains("401", refused!.Error);
    }

    private async Task ConnectAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<GitHubSettingsStore>().SaveAsync(PowerLoomHost.Vault, new GitHubSettings { Enabled = true, Token = "good-token", Login = "sam" }, CancellationToken.None);
    }

    private async Task<IReadOnlyList<CronEntry>> EntriesAsync()
    {
        return await host.Host.Services.GetServices<ICronSource>().OfType<GitHubCronSource>().Single().EntriesAsync(CancellationToken.None);
    }

    private Task<ITrackedSession> CheckAsync() => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncGitHubPullRequests(PowerLoomHost.Vault)).AsTask());

    private async Task<GitHubCheckStatus?> StatusAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await VaultSettings.ReadAsync<GitHubCheckStatus>(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), PowerLoomHost.Vault, "githubStatus", CancellationToken.None);
    }
}
