using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.GitHubIntegration.Features.Connection.Models;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Scheduling;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.GitHub;

// Settings → Sync → GitHub pull requests (user decision 2026-10-25): on once GitHub is connected, its own schedule, and
// how the last check went.
[Collection(PowerLoomCollection.Name)]
public sealed class GitHubPullRequestSyncSettingsTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private static readonly string Url = $"/api/vaults/{PowerLoomHost.Vault}/github/pull-requests";

    private FakeGitHubClient GitHub => host.Host.Services.GetRequiredService<FakeGitHubClientFactory>().Client;

    [Fact]
    public async Task The_check_runs_on_its_own_schedule_while_on_and_a_bad_cron_is_refused()
    {
        await ConnectAsync();

        var on = await EntriesAsync();
        await host.Host.PutJson(new SaveGitHubPullRequestsRequest(false, "*/10 * * * *"), Url).Receive<GitHubSummary>();
        var off = await EntriesAsync();
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveGitHubPullRequestsRequest(true, "every minute")).ToUrl(Url);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
        await host.Host.PutJson(new SaveGitHubPullRequestsRequest(true, "*/10 * * * *"), Url).Receive<GitHubSummary>();
        var again = await EntriesAsync();

        Assert.Contains(on, entry => entry.Key == $"github-pull-requests:{PowerLoomHost.Vault}" && entry.Cron == GitHubSettings.DefaultPullRequestsCron);
        Assert.DoesNotContain(off, entry => entry.Key.StartsWith("github-pull-requests:"));
        Assert.Contains(again, entry => entry.Key == $"github-pull-requests:{PowerLoomHost.Vault}" && entry.Cron == "*/10 * * * *");
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
