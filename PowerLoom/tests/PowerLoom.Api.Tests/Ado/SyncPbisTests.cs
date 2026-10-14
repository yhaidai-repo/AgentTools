using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncRepositories;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Ado;

[Collection(PowerLoomCollection.Name)]
public sealed class SyncPbisTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task The_sprint_sync_brings_the_tasks_parents_records_bugs_and_marks_changed_content_stale()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.QueryResult = [51010, 51011, 51012];
        ado.WorkItems =
        [
            WorkItemMapperTests.Item(51010, 1, """{"System.WorkItemType":"Task","System.Title":"Write it","System.Parent":51001,"Microsoft.VSTS.Scheduling.Effort":3}"""),
            WorkItemMapperTests.Item(51011, 1, """{"System.WorkItemType":"Task","System.Title":"[BUG] It breaks","System.Parent":51001,"System.State":"New","Microsoft.VSTS.Scheduling.Effort":2.5}"""),
            WorkItemMapperTests.Item(51012, 1, """{"System.WorkItemType":"Task","System.Title":"Dropped","System.Parent":51001,"System.State":"Removed","Microsoft.VSTS.Scheduling.Effort":8}"""),
            WorkItemMapperTests.Item(51001, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"The PBI","System.State":"Committed","System.IterationPath":"proj\\Sprint 7","System.Description":"<p>v1</p>"}"""),
        ];

        var session = await Sync(null);
        var pbi = await LoadAsync(51001);
        var bug = await LoadBugAsync(51011);

        Assert.Equal((PipelineStatus.New, "v1", "proj\\Sprint 7"), (pbi.PipelineStatus, pbi.DescriptionMd, pbi.IterationPath));
        Assert.Equal((51001, PipelineStatus.New, BugSource.Ado), (bug.PbiId, bug.FoundIn, bug.Source));
        Assert.Equal(51001, (await LoadAsync(51011)).ParentId);
        Assert.Equal(PowerLoomHost.Vault, session.Sent.SingleMessage<SyncRepositories>().Vault);
        // The bug is prepared without the user, right after the sync that brought it.
        Assert.Equal([(51011, "sync")], session.Sent.MessagesOf<PreparePbi>().Select(prepare => (prepare.AdoId, prepare.Actor)).ToList());
        Assert.Equal(RunOutcome.Success, await LastSyncRunOutcomeAsync());
        // The PBI's effort is the user's Tasks under it (the scope query's result), the bug's included once and the removed
        // Task left out.
        Assert.Equal(5.5m, await SnapshotEffortAsync(51001));
        Assert.Equal(1, await CountSnapshotsAsync("proj\\Sprint 7"));

        ado.WorkItems[3] = WorkItemMapperTests.Item(51001, 2, """{"System.WorkItemType":"Product Backlog Item","System.Title":"The PBI","System.State":"Committed","System.IterationPath":"proj\\Sprint 7","System.Description":"<p>v2</p>"}""");
        await SetStatusAsync(51001, PipelineStatus.Refining);

        await Sync(null);

        var updated = await LoadAsync(51001);

        Assert.Equal((PipelineStatus.Stale, "v2", 2), (updated.PipelineStatus, updated.DescriptionMd, updated.Rev));
    }

    [Fact]
    public async Task One_pbi_is_synced_by_id_from_any_sprint()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.WorkItems.Add(WorkItemMapperTests.Item(51002, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Elsewhere","System.State":"Done","System.IterationPath":"proj\\Sprint 3"}"""));

        var session = await Sync(51002);

        Assert.Equal(PipelineStatus.Closed, (await LoadAsync(51002)).PipelineStatus);
        Assert.Empty(session.Sent.MessagesOf<SyncRepositories>());
    }

    [Fact]
    public async Task The_discussion_is_read_when_the_rev_moves_and_a_prepared_pbis_note_shows_it()
    {
        const int adoId = 51020;
        const string notePath = "pbi/PBI-51020-talk/PBI-51020.md";
        var noteFile = Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, notePath);

        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.WorkItems.Add(WorkItemMapperTests.Item(adoId, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Talk","System.State":"New"}"""));
        ado.Comments[adoId] = [new AdoComment("Ann", new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc), "<p>Use the old API.</p>")];

        var first = await Sync(adoId);
        var read = await LoadAsync(adoId);

        Assert.Equal(("### Ann · 2026-10-01\n\n> Use the old API.", 1), (read.DiscussionMd, read.DiscussionRev));
        // Not prepared yet: no note to render.
        Assert.DoesNotContain(first.Sent.MessagesOf<PbiChanged>(), changed => changed.AdoId == adoId);

        await PrepareAsync(adoId, noteFile, notePath);
        ado.WorkItems[^1] = WorkItemMapperTests.Item(adoId, 2, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Talk","System.State":"Committed"}""");
        ado.Comments[adoId].Add(new AdoComment("Bo", new DateTime(2026, 10, 2, 8, 0, 0, DateTimeKind.Utc), "<h2>Notes</h2><p>Agreed.</p>"));

        var second = await Sync(adoId);
        var note = await File.ReadAllTextAsync(noteFile);

        Assert.Contains(second.Sent.MessagesOf<PbiChanged>(), changed => changed.AdoId == adoId);
        Assert.Contains("| ADO state | Committed |", note);
        Assert.Contains("## Discussion\n\n### Ann · 2026-10-01\n\n> Use the old API.\n\n### Bo · 2026-10-02\n\n> ## Notes", note);
        // A heading inside a comment is quoted, so the user's own section still starts at the last line.
        Assert.EndsWith("## Notes\n\nKeep this.\n", note);

        var third = await Sync(adoId);

        Assert.DoesNotContain(third.Sent.MessagesOf<PbiChanged>(), changed => changed.AdoId == adoId);
    }

    private async Task PrepareAsync(int adoId, string noteFile, string notePath)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        Directory.CreateDirectory(Path.GetDirectoryName(noteFile)!);
        await File.WriteAllTextAsync(noteFile, "# old\n\n## Notes\n\nKeep this.\n");
        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.VaultPath, notePath));
    }

    private Task<ITrackedSession> Sync(int? adoId) => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => Publish(bus, adoId));

    private static Task Publish(IMessageContext bus, int? adoId) => bus.PublishAsync(new SyncPbis(PowerLoomHost.Vault, adoId)).AsTask();

    private async Task ConfigureAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<AdoSettingsStore>();

        await store.SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
        await store.SaveSyncAsync(PowerLoomHost.Vault, new SyncSettings { MaxItemsPerRun = 400 }, CancellationToken.None);
    }

    private async Task<WorkItem> LoadAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == adoId);
    }

    private async Task<Bug> LoadBugAsync(int workItemId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Bugs.AsNoTracking().SingleAsync(row => row.WorkItemId == workItemId);
    }

    private async Task SetStatusAsync(int adoId, PipelineStatus status)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.PipelineStatus, status));
    }

    private async Task<RunOutcome> LastSyncRunOutcomeAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().AgentRuns.AsNoTracking().Where(run => run.Stage == Stage.Sync).OrderByDescending(run => run.Id).Select(run => run.Outcome).FirstAsync();
    }

    private async Task<decimal?> SnapshotEffortAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.Where(row => row.AdoId == adoId).Select(row => row.Effort).SingleAsync();
    }

    private async Task<int> CountSnapshotsAsync(string iterationPath)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.CountAsync(row => row.IterationPath == iterationPath);
    }
}
