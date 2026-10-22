using PowerLoom.Persistence.Runs;
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
    public async Task A_pbi_moved_out_of_the_sprint_stays_in_its_snapshot_with_the_state_it_left_in()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        ado.QueryResult = [];
        ado.WorkItems = [];
        await AddSnapshotAsync(new SprintSnapshot { IterationPath = "proj\\Sprint 7", TakenOn = yesterday, AdoId = 51090, AdoState = "Testing", Effort = 4m });

        try
        {
            await Sync(null);

            var today = await LoadSnapshotAsync(51090, yesterday.AddDays(1));

            Assert.Equal(("Testing", 4m), (today.AdoState, today.Effort));
        }
        finally
        {
            await ForgetSnapshotsAsync(51090);
        }
    }

    [Fact]
    public async Task The_sprint_sync_brings_the_tasks_parents_records_bugs_and_keeps_the_status_on_changed_content()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.QueryResult = [51010, 51011, 51012];
        ado.WorkItems =
        [
            WorkItemMapperTests.Item(51010, 1, """{"System.WorkItemType":"Task","System.Title":"Write it","System.Parent":51001,"Microsoft.VSTS.Scheduling.OriginalEstimate":3}"""),
            WorkItemMapperTests.Item(51011, 1, """{"System.WorkItemType":"Task","System.Title":"[BUG] It breaks","System.Parent":51001,"System.State":"New","Microsoft.VSTS.Scheduling.OriginalEstimate":2.5}"""),
            WorkItemMapperTests.Item(51012, 1, """{"System.WorkItemType":"Task","System.Title":"Dropped","System.Parent":51001,"System.State":"Removed","Microsoft.VSTS.Scheduling.OriginalEstimate":8}"""),
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

        // A content change brings the new text and keeps the status.
        Assert.Equal((PipelineStatus.Refining, "v2", 2), (updated.PipelineStatus, updated.DescriptionMd, updated.Rev));
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
    public async Task A_refined_pbi_given_to_another_team_member_is_closed_with_its_items_but_its_findings()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.WorkItems.Add(Pbi(51040, 1, "Committed", "sam@x.io"));
        ado.WorkItems.Add(Pbi(51041, 1, "Committed", "sam@x.io"));
        await Sync(51040);
        await Sync(51041);
        await SetStatusAsync(51040, PipelineStatus.ReadyForDev);
        await SeedItemsAsync(51040);
        ado.WorkItems[^2] = Pbi(51040, 2, "Committed", "Ann@x.io");
        ado.WorkItems[^1] = Pbi(51041, 2, "Committed", "ann@x.io");

        await Sync(51040);
        await Sync(51041);

        var pbi = await LoadAsync(51040);
        var items = await LoadItemsAsync(51040);

        Assert.Equal((PipelineStatus.Closed, true), (pbi.PipelineStatus, pbi.ClosedByUser));
        Assert.Equal((ItemStatus.Cancelled, ItemStatus.Cancelled, ItemStatus.Open), (items["Q-51040-001"], items["WT-51040"], items["F-51040"]));
        // One not prepared yet has nothing waiting: it stays as it is.
        Assert.Equal(PipelineStatus.New, (await LoadAsync(51041)).PipelineStatus);
    }

    [Fact]
    public async Task A_pbi_done_in_ado_is_closed_with_its_items_but_its_findings()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.WorkItems.Add(Pbi(51042, 1, "Committed", "sam@x.io"));
        await Sync(51042);
        await SetStatusAsync(51042, PipelineStatus.Development);
        await SeedItemsAsync(51042);
        ado.WorkItems[^1] = Pbi(51042, 2, "Done", "sam@x.io");

        await Sync(51042);

        var pbi = await LoadAsync(51042);
        var items = await LoadItemsAsync(51042);

        Assert.Equal((PipelineStatus.Closed, false), (pbi.PipelineStatus, pbi.ClosedByUser));
        Assert.Equal((ItemStatus.Cancelled, ItemStatus.Cancelled, ItemStatus.Open), (items["Q-51042-001"], items["WT-51042"], items["F-51042"]));
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
        // Not prepared yet, and still its note is written.
        Assert.Contains(first.Sent.MessagesOf<PbiChanged>(), changed => changed.AdoId == adoId);
        Assert.Contains("## Discussion\n\n### Ann · 2026-10-01", await File.ReadAllTextAsync(noteFile));
        Assert.Equal(PipelineStatus.New, read.PipelineStatus);

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

    [Fact]
    public async Task An_item_synced_before_its_teams_text_fields_were_read_gets_them_once_and_its_note_shows_them()
    {
        const int adoId = 51030;
        const string notePath = "pbi/PBI-51030-notes/PBI-51030.md";
        var noteFile = Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, notePath);

        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        const string attached = "https://dev.azure.com/org/p1/_apis/wit/attachments/n-1?fileName=edi.txt";

        ado.WorkItems.Add(WorkItemMapperTests.Item(adoId, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Notes","System.State":"Committed","Custom.Notes":"<ul><li>NM101 is parsed</li></ul>"}""") with
        {
            Relations = [new AdoWorkItemRelation("AttachedFile", "https://dev.azure.com/org/p1/_apis/wit/attachments/n-1", new Dictionary<string, System.Text.Json.JsonElement> { ["name"] = System.Text.Json.JsonSerializer.SerializeToElement("edi.txt") })],
        });
        ado.Downloads[attached] = new AdoDownload("edi.txt", "text/plain", System.Text.Encoding.UTF8.GetBytes("LS*2120~"));
        await Sync(adoId);
        await PrepareAsync(adoId, noteFile, notePath);
        await ForgetExtraFieldsAsync(adoId);

        var session = await Sync(adoId);
        var note = await File.ReadAllTextAsync(noteFile);

        Assert.Contains(session.Sent.MessagesOf<PbiChanged>(), changed => changed.AdoId == adoId);
        Assert.Contains("## More from Azure DevOps\n\n### Notes\n\n- NM101 is parsed", note);
        Assert.EndsWith("## Notes\n\nKeep this.\n", note);
        Assert.Equal(PipelineStatus.New, (await LoadAsync(adoId)).PipelineStatus);
        // The file attached in ADO is the PBI's attachment, without Prepare.
        Assert.Equal([(attached, "LS*2120~")], await AttachmentsAsync(adoId));
    }

    private async Task<List<(string?, string?)>> AttachmentsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var rows = await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Attachments.AsNoTracking().Where(row => row.PbiId == adoId).ToListAsync();

        return rows.Select(row => (row.SourceUrl, row.Text)).ToList();
    }

    private async Task ForgetExtraFieldsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.ExtraFieldsMd, (string?)null));
    }

    private async Task PrepareAsync(int adoId, string noteFile, string notePath)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        Directory.CreateDirectory(Path.GetDirectoryName(noteFile)!);
        await File.WriteAllTextAsync(noteFile, "# old\n\n## Notes\n\nKeep this.\n");
        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.VaultPath, notePath));
    }

    private static AdoWorkItem Pbi(int adoId, int rev, string state, string assignee)
    {
        return WorkItemMapperTests.Item(adoId, rev, $$$"""{"System.WorkItemType":"Product Backlog Item","System.Title":"Handed on","System.State":"{{{state}}}","System.AssignedTo":{"uniqueName":"{{{assignee}}}"}}""");
    }

    // An open question, a blocked tech-writer task and an open finding.
    private async Task SeedItemsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem { Id = $"Q-{adoId}-001", Kind = ItemKind.Question, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Which way?", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"WT-{adoId}", Kind = ItemKind.Docs, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Merge draft", Status = ItemStatus.Blocked, Assignee = "agent:tech-writer", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"F-{adoId}", Kind = ItemKind.Finding, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "A known issue", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private async Task<Dictionary<string, ItemStatus>> LoadItemsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId).ToDictionaryAsync(item => item.Id, item => item.Status);
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

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().AgentRuns.AsNoTracking().Where(run => run.Stage == JobStages.Sync).OrderByDescending(run => run.Id).Select(run => run.Outcome).FirstAsync();
    }

    private async Task<decimal?> SnapshotEffortAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.Where(row => row.AdoId == adoId).Select(row => row.Effort).SingleAsync();
    }

    private async Task AddSnapshotAsync(SprintSnapshot snapshot)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.SprintSnapshots.Add(snapshot);

        await db.SaveChangesAsync();
    }

    private async Task<SprintSnapshot> LoadSnapshotAsync(int adoId, DateOnly takenOn)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.AsNoTracking().SingleAsync(row => row.AdoId == adoId && row.TakenOn == takenOn);
    }

    private async Task ForgetSnapshotsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.Where(row => row.AdoId == adoId).ExecuteDeleteAsync();
    }

    private async Task<int> CountSnapshotsAsync(string iterationPath)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SprintSnapshots.CountAsync(row => row.IterationPath == iterationPath);
    }
}
