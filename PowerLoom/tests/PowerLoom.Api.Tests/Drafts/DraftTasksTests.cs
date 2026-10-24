using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Drafts;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Drafts;

[Collection(PowerLoomCollection.Name)]
public sealed class DraftTasksTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Every_draft_gets_a_tech_writer_task_and_a_gone_draft_ends_its_task_and_marks_the_capture_merged()
    {
        const int adoId = 67001;
        var capture = host.Host.Services.GetRequiredService<FakeVaultCapture>();
        var captureId = await SeedAsync(adoId, "pvs-topic");

        capture.Drafts[PowerLoomHost.Vault] =
        [
            new VaultDraft("chat-note", "Draft: Chat note", "pvs", "2026-10-11", "chat", "[[pvs-index]]", "draft/chat-note.md", false),
            new VaultDraft("pvs-topic", "Topic (draft)", "pvs", "2026-10-10", "session finding: powerloom", "[[pvs-index]]", "draft/pvs-topic.md", true),
        ];

        await ScanAsync();

        var tasks = await DraftTasksAsync();
        var topic = tasks.Single(task => task.Body == "pvs-topic");
        var chat = tasks.Single(task => task.Body == "chat-note");

        Assert.Equal(2, tasks.Count);
        Assert.Equal((ItemKinds.Docs, AgentStages.AnyAgent, ItemStatus.Open, adoId, "Merge draft: Topic"), (topic.Kind, topic.Assignee, topic.Status, topic.PbiId, topic.Title));
        Assert.Equal(("Merge draft: Chat note", (int?)null), (chat.Title, chat.PbiId));
        Assert.Contains("\"key\": \"merge:pvs-topic:2026-10-10\"", topic.Data);
        Assert.Contains("\"path\": \"draft/pvs-topic.md\"", topic.Data);
        Assert.True(string.CompareOrdinal(topic.Id, chat.Id) < 0, "PowerLoom's draft is taken first");

        // A second scan creates nothing; then the topic draft is merged by hand.
        await ScanAsync();
        capture.Drafts[PowerLoomHost.Vault].RemoveAll(draft => draft.Name == "pvs-topic");
        await ScanAsync();

        var ended = await LoadTaskAsync(topic.Id);

        Assert.Equal(2, (await DraftTasksAsync()).Count);
        Assert.Equal(ItemStatus.Done, ended.Status);
        Assert.StartsWith("The draft is no longer in draft/", ended.Resolution);
        Assert.Equal(ItemStatus.Open, (await LoadTaskAsync(chat.Id)).Status);
        Assert.Equal("merged", await CaptureStatusAsync(captureId));
        Assert.Contains(await CronEntriesAsync(), entry => entry.Key == $"drafts:{PowerLoomHost.Vault}" && entry.Message is ScanVaultDrafts scan && scan.Vault == PowerLoomHost.Vault);
    }

    private async Task ScanAsync()
    {
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.PublishAsync(new ScanVaultDrafts(PowerLoomHost.Vault)));
    }

    private async Task<int> SeedAsync(int adoId, string captureName)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var run = new AgentRun { PbiId = adoId, Stage = "research", Outcome = RunOutcome.Success, EndedAt = DateTime.UtcNow };
        var capture = new VaultCapture { Run = run, PbiId = adoId, Title = "Topic", Project = "pvs", Target = "[[pvs-index]]", Captured = "[]", ToFill = "[]", Name = captureName, Assumptions = "[]", Status = "created", Errors = "[]" };

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Researching, SyncedAt = DateTime.UtcNow });
        db.VaultCaptures.Add(capture);
        await db.SaveChangesAsync();

        return capture.Id;
    }

    private async Task<List<LocalItem>> DraftTasksAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking()
            .Where(item => item.Kind == ItemKinds.Docs && item.Vault == PowerLoomHost.Vault && (item.Body == "pvs-topic" || item.Body == "chat-note")).OrderBy(item => item.Id).ToListAsync();
    }

    private async Task<LocalItem> LoadTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<string> CaptureStatusAsync(int id)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().VaultCaptures.AsNoTracking().Where(capture => capture.Id == id).Select(capture => capture.Status).SingleAsync();
    }

    private async Task<List<CronEntry>> CronEntriesAsync()
    {
        var entries = new List<CronEntry>();

        foreach (var source in host.Host.Services.GetServices<ICronSource>())
            entries.AddRange(await source.EntriesAsync(CancellationToken.None));

        return entries;
    }
}
