using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Settings;
using PowerLoom.Features.Cleanup;
using PowerLoom.Features.Cleanup.Cleaners;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Cleanup;

[Collection(PowerLoomCollection.Name)]
public sealed class CleanupJobTests(PowerLoomHost host)
{
    private const int ClosedPbi = 68001;
    private const int OpenPbi = 68002;
    private static readonly string ClosedFolder = $"pbi/PBI-{ClosedPbi}-closed-one";
    private static readonly string OpenFolder = $"pbi/PBI-{OpenPbi}-open-one";
    private const string Token = "0123456789abcdef0123456789abcdef";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private static readonly DateTime LongAgo = DateTime.UtcNow.AddDays(-100);

    // Past the 14-day buffer of a run's recordings, inside the 60 days a failed run keeps them.
    private static readonly DateTime RunEnded = DateTime.UtcNow.AddDays(-20);

    [Fact]
    public async Task A_dry_run_reports_every_store_without_removing_anything_and_a_real_run_removes_it()
    {
        var devHub = host.Host.Services.GetRequiredService<FakeDevHubBrowserArtefacts>();
        var (oldRun, failedRun) = await SeedAsync();
        var trashed = TrashFile("cleanup/old.md", LongAgo);
        var failedImport = FailedImportFile("stale.json", LongAgo);

        devHub.Owners.Add(new OwnerArtefacts($"powerloom-run-{oldRun}", 5000, LongAgo));
        devHub.Owners.Add(new OwnerArtefacts($"powerloom-run-{failedRun}", 7000, LongAgo));
        devHub.Owners.Add(new OwnerArtefacts("someone-else", 1, LongAgo));
        await SaveSettingsAsync(dryRun: true);

        await RunAsync();

        var dryRun = await host.Host.GetAsJson<CleanupStatus>($"/api/vaults/{PowerLoomHost.Vault}/cleanup");
        var stores = dryRun!.LastReport!.Stores.ToDictionary(store => store.Store);

        Assert.True(dryRun.LastReport.DryRun);
        Assert.Equal(3, stores[ClosedPbiFoldersCleaner.StoreName].Items);
        Assert.Equal(1, stores[TrashCleaner.StoreName].Items);
        Assert.Equal(2, stores[FailedImportsCleaner.StoreName].Items);
        Assert.Equal(1, stores[RunEventsCleaner.StoreName].Items);
        Assert.Equal(1, stores[BrowserArtefactsCleaner.StoreName].Items);
        Assert.True(stores[ClosedPbiFoldersCleaner.StoreName].Bytes > 0);
        Assert.True(Directory.Exists(BacklogPath(ClosedFolder)));
        Assert.True(File.Exists(trashed));
        Assert.True(File.Exists(failedImport));
        Assert.Equal([($"powerloom-run-{oldRun}", true)], devHub.Deletes);
        Assert.Equal(2, await RunEventRowsAsync(oldRun));
        Assert.Contains(await LogRowsAsync(), row => row.Resource == ClosedPbiFoldersCleaner.StoreName && row.Target == ClosedFolder && row.Outcome == CleanupLog.Planned && row.Request == "dry-run");

        devHub.Deletes.Clear();
        await SaveSettingsAsync(dryRun: false);

        await RunAsync();

        var real = await host.Host.GetAsJson<CleanupStatus>($"/api/vaults/{PowerLoomHost.Vault}/cleanup");
        var notes = await UserNotesAsync(ClosedPbi);

        Assert.False(real!.LastReport!.DryRun);
        Assert.False(Directory.Exists(BacklogPath(ClosedFolder)));
        Assert.True(File.Exists(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, ".trash", ClosedFolder, $"PBI-{ClosedPbi}.md")));
        Assert.False(File.Exists(BacklogPath($"chats/pbi-{ClosedPbi}.md")));
        Assert.False(File.Exists(BacklogPath("reviews/PR-9001.md")));
        Assert.True(Directory.Exists(BacklogPath(OpenFolder)), "an open PBI keeps its folder");
        Assert.Equal("Keep me.", notes);
        Assert.False(File.Exists(trashed));
        Assert.False(File.Exists(failedImport));
        Assert.Equal(0, await RunEventRowsAsync(oldRun));
        Assert.Equal(1, await UsageRowsAsync(oldRun));
        Assert.Equal([($"powerloom-run-{oldRun}", false)], devHub.Deletes);
        Assert.Contains(devHub.Owners, owner => owner.Owner == $"powerloom-run-{failedRun}");
        Assert.Contains(await LogRowsAsync(), row => row.Resource == TrashCleaner.StoreName && row.Outcome == CleanupLog.Ok && row.Request == "delete");
        Assert.Contains(await CronEntriesAsync(), entry => entry.Key == $"cleanup:{PowerLoomHost.Vault}" && entry.Cron == CleanupCronSource.Cron && entry.Message is CleanUpArtefacts);
    }

    [Fact]
    public async Task A_store_set_to_zero_days_is_off_and_unreachable_DevHub_is_tried_again_tomorrow()
    {
        var devHub = host.Host.Services.GetRequiredService<FakeDevHubBrowserArtefacts>();

        devHub.Reachable = false;
        await SaveSettingsAsync(dryRun: true, trashDays: 0);

        try
        {
            await RunAsync();
        }
        finally
        {
            devHub.Reachable = true;
        }

        var status = await host.Host.GetAsJson<CleanupStatus>($"/api/vaults/{PowerLoomHost.Vault}/cleanup");
        var stores = status!.LastReport!.Stores.ToDictionary(store => store.Store);

        Assert.Equal("off (0 days)", stores[TrashCleaner.StoreName].Note);
        Assert.Contains("DevHub", stores[BrowserArtefactsCleaner.StoreName].Note);
    }

    [Fact]
    public async Task Negative_days_and_a_shorter_buffer_for_failed_runs_are_refused()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveCleanupSettingsRequest(true, -1, 90, 30, 90, 14, 60)).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/cleanup");
            scenario.StatusCodeShouldBe(System.Net.HttpStatusCode.BadRequest);
        });
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveCleanupSettingsRequest(true, 30, 90, 30, 90, 14, 7)).ToUrl($"/api/vaults/{PowerLoomHost.Vault}/cleanup");
            scenario.StatusCodeShouldBe(System.Net.HttpStatusCode.BadRequest);
        });
    }

    private async Task RunAsync()
    {
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.PublishAsync(new CleanUpArtefacts(PowerLoomHost.Vault)));
    }

    // A PBI closed 100 days ago with a folder, a chat note and a review note; an open one with a folder; a run (ended
    // 20 days ago) whose usage record is 100 days old, with events; a run whose test report failed a case.
    private async Task<(long OldRun, long FailedRun)> SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var oldRun = new AgentRun { PbiId = ClosedPbi, Stage = "research", Outcome = RunOutcome.Success, StartedAt = RunEnded, EndedAt = RunEnded.AddMinutes(5) };
        var failedRun = new AgentRun { PbiId = ClosedPbi, Stage = "research", Outcome = RunOutcome.Success, StartedAt = RunEnded, EndedAt = RunEnded.AddMinutes(5) };

        db.WorkItems.Add(Pbi(ClosedPbi, PipelineStatus.Closed, $"{ClosedFolder}/PBI-{ClosedPbi}.md"));
        db.WorkItems.Add(Pbi(OpenPbi, PipelineStatus.Development, $"{OpenFolder}/PBI-{OpenPbi}.md"));
        db.StatusHistories.Add(new StatusHistory { EntityKind = EntityKind.Pbi, EntityId = ClosedPbi.ToString(), FromStatus = "done", ToStatus = "closed", At = LongAgo, Actor = "test" });
        db.PullRequests.Add(new PullRequest { Id = 9001, RepoId = "r", RepoName = "repo", Title = "PR", SourceRef = "refs/heads/a", TargetRef = "refs/heads/main", SourceCommit = "c", WorkItemIds = $"[{ClosedPbi}]", Url = "http://pr", Vault = PowerLoomHost.Vault, Origin = "ado", SyncedAt = DateTime.UtcNow });
        db.AgentRuns.AddRange(oldRun, failedRun);
        await db.SaveChangesAsync();

        db.LocalItems.Add(new LocalItem { Id = $"TR-{ClosedPbi}-001", Vault = PowerLoomHost.Vault, PbiId = ClosedPbi, Kind = ItemKind.TestReport, Status = ItemStatus.Done, Title = "report", Assignee = "autotest", HeldBy = "[]", CreatedByRun = failedRun.Id, Data = """{"report":{"results":[{"case":"TC-1","verdict":"fail"}]}}""", CreatedAt = LongAgo, UpdatedAt = LongAgo });
        await db.SaveChangesAsync();
        await SeedUsageAsync(db, oldRun.Id);
        await scope.ServiceProvider.GetRequiredService<DevHubSettingsStore>().SaveAsync(PowerLoomHost.Vault, new DevHubSettings { Enabled = true, Token = Token }, CancellationToken.None);

        WriteBacklogFile($"{ClosedFolder}/PBI-{ClosedPbi}.md", "# PBI\n\nbody\n\n## Notes\n\nKeep me.\n");
        WriteBacklogFile($"{ClosedFolder}/tasks/RT-{ClosedPbi}-001.md", "task");
        WriteBacklogFile($"chats/pbi-{ClosedPbi}.md", "chat");
        WriteBacklogFile("reviews/PR-9001.md", "review");
        WriteBacklogFile($"{OpenFolder}/PBI-{OpenPbi}.md", "# open\n\n## Notes\n");

        return (oldRun.Id, failedRun.Id);
    }

    private static async Task SeedUsageAsync(PowerLoomDbContext db, long runId)
    {
        var id = runId.ToString();
        var at = LongAgo;

        await db.Database.ExecuteSqlAsync($"insert into agent_usage.usage_record (run_id, labels, started_at, ended_at, duration_ms, turns, outcome, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, models) values ({id}, '{{}}'::jsonb, {at}, {at}, 1, 1, 'success', 1, 1, 0, 0, 0.1, '[]'::jsonb) on conflict do nothing");
        await db.Database.ExecuteSqlAsync($"insert into agent_usage.run_event (run_id, seq, at, type, payload) values ({id}, 1, {at}, 'tool', '{{}}'::jsonb), ({id}, 2, {at}, 'tool', '{{}}'::jsonb) on conflict do nothing");
    }

    private static WorkItem Pbi(int adoId, PipelineStatus status, string vaultPath) =>
        new() { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Done", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = status, VaultPath = vaultPath, SyncedAt = DateTime.UtcNow, AdoChangedAt = LongAgo };

    private async Task SaveSettingsAsync(bool dryRun, int trashDays = 90)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<CleanupSettingsStore>().SaveAsync(PowerLoomHost.Vault, new CleanupSettings { DryRun = dryRun, TrashDays = trashDays }, CancellationToken.None);
    }

    private string BacklogPath(string relative) => Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, relative);

    private void WriteBacklogFile(string relative, string content)
    {
        var path = BacklogPath(relative);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
    }

    private string TrashFile(string relative, DateTime modifiedAt)
    {
        var path = Path.Combine(host.VaultRoot, ".trash", relative);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "gone");
        File.SetLastWriteTimeUtc(path, modifiedAt);

        return path;
    }

    private string FailedImportFile(string name, DateTime modifiedAt)
    {
        var folder = Path.Combine(host.ImportRoot, "failed");
        var path = Path.Combine(folder, name);

        Directory.CreateDirectory(folder);
        File.WriteAllText(path, "{}");
        File.WriteAllText($"{path}.reason.txt", "bad");
        File.SetLastWriteTimeUtc(path, modifiedAt);
        File.SetLastWriteTimeUtc($"{path}.reason.txt", modifiedAt);

        return path;
    }

    private async Task<string?> UserNotesAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.UserNotesMd).SingleAsync();
    }

    private async Task<int> RunEventRowsAsync(long runId)
    {
        using var scope = host.Host.Services.CreateScope();
        var id = runId.ToString();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.SqlQuery<int>($"select count(*)::int as \"Value\" from agent_usage.run_event where run_id = {id}").SingleAsync();
    }

    private async Task<int> UsageRowsAsync(long runId)
    {
        using var scope = host.Host.Services.CreateScope();
        var id = runId.ToString();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Database.SqlQuery<int>($"select count(*)::int as \"Value\" from agent_usage.usage_record where run_id = {id}").SingleAsync();
    }

    private async Task<List<DataAccess>> LogRowsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().DataAccesses.AsNoTracking().Where(row => row.Kind == CleanupLog.Kind && row.Vault == PowerLoomHost.Vault).ToListAsync();
    }

    private async Task<List<CronEntry>> CronEntriesAsync()
    {
        var entries = new List<CronEntry>();

        foreach (var source in host.Host.Services.GetServices<ICronSource>())
            entries.AddRange(await source.EntriesAsync(CancellationToken.None));

        return entries;
    }
}
