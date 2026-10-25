using System.Text;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.ConfluenceIntegration.Client.Models;
using PowerLoom.ConfluenceIntegration.Features.LoadPage.Models;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Confluence;
using PowerLoom.Features.Pbis.ConfluenceLinks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Confluence;

[Collection(PowerLoomCollection.Name)]
public sealed class ConfluencePagesTests(PowerLoomHost host)
{
    private const int AdoId = 64001;
    private const string PageUrl = "https://org.atlassian.net/wiki/spaces/ZZ/pages/1234/Credit+Rules";
    private const string GoneUrl = "https://org.atlassian.net/wiki/spaces/ZZ/pages/9999/Gone";

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Linked_pages_are_fetched_with_their_files_replaced_on_a_new_version_and_asked_for_when_they_fail()
    {
        await SeedAsync();
        var confluence = host.Host.Services.GetRequiredService<FakeConfluenceClientFactory>();

        confluence.Client.Pages[PageUrl] = new ConfluencePage("1234", "Credit Rules", 3, "<p>Rules v3</p>");
        confluence.Client.Files[PageUrl] = [new ConfluenceFile("f1", "rules.txt", "text/plain", 5, "https://x/f1"), new ConfluenceFile("f2", "big.zip", "application/zip", 5, "https://x/f2")];
        confluence.Client.Downloads["f1"] = new DownloadedFile("rules.txt", "text/plain", Encoding.UTF8.GetBytes("rules"));

        var synced = await Tracked(bus => bus.PublishAsync(new SyncPbiPages(PowerLoomHost.Vault, AdoId, PageSyncScope.All)).AsTask());
        var first = await LoadAttachmentsAsync();

        Assert.Equal([("Credit Rules.html", 3, "Rules v3"), ("rules.txt", 3, "rules")], first.Where(row => row.SourceUrl == PageUrl).Select(row => (row.FileName, row.SourceVersion, row.Text)));
        Assert.Single(synced.Executed.MessagesOf<PbiChanged>());
        Assert.Contains("Attach the content of the linked Confluence page", (await LoadTasksAsync()).Single(task => task.Body!.Contains(GoneUrl)).Title);

        confluence.Client.Pages[PageUrl] = new ConfluencePage("1234", "Credit Rules", 4, "<p>Rules v4</p>");
        confluence.Client.Files[PageUrl] = [];

        await Tracked(bus => bus.PublishAsync(new SyncPbiPages(PowerLoomHost.Vault, AdoId, PageSyncScope.Missing)).AsTask());

        Assert.Equal([3, 3], (await LoadAttachmentsAsync()).Where(row => row.SourceUrl == PageUrl).Select(row => row.SourceVersion));

        await Tracked(_ => host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new LoadPageRequest(PageUrl)).ToUrl($"/api/pbis/{AdoId}/confluence-pages/load");
            scenario.StatusCodeShouldBe(202);
        }));
        var reloaded = await LoadAttachmentsAsync();

        Assert.Equal([("Credit Rules.html", 4)], reloaded.Where(row => row.SourceUrl == PageUrl).Select(row => (row.FileName, row.SourceVersion)));
    }

    [Fact]
    public async Task Confluence_links_are_listed_once_and_removed()
    {
        await SeedAsync();

        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddLinkRequest("https://example.com/not-confluence", "why")).ToUrl($"/api/pbis/{AdoId}/confluence-links");
            scenario.StatusCodeShouldBe(400);
        });
        var added = await host.Host.PostJson(new AddLinkRequest(PageUrl, "the rules"), $"/api/pbis/{AdoId}/confluence-links").Receive<List<PbiConfluencePage>>();
        var again = await host.Host.PostJson(new AddLinkRequest(PageUrl, "other words"), $"/api/pbis/{AdoId}/confluence-links").Receive<List<PbiConfluencePage>>();
        var removed = await RemoveAsync(PageUrl);

        Assert.Contains("not a Confluence page link", await refused.ReadAsTextAsync());
        Assert.Equal([new PbiConfluencePage(PageUrl, "Credit Rules", "the rules", "user")], added);
        Assert.Equal(added, again);
        Assert.Empty(removed);
    }

    private async Task<List<PbiConfluencePage>> RemoveAsync(string url)
    {
        var response = await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new RemoveLinkRequest(url)).ToUrl($"/api/pbis/{AdoId}/confluence-links");
            scenario.StatusCodeShouldBeOk();
        });

        return response.ReadAsJson<List<PbiConfluencePage>>()!;
    }

    private Task<ITrackedSession> Tracked(Func<IMessageContext, Task> action) => host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(action);

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        if (await db.WorkItems.AnyAsync(row => row.AdoId == AdoId))
            return;

        db.WorkItems.Add(new WorkItem { AdoId = AdoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Pages PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow, DescriptionMd = $"See {PageUrl} and {GoneUrl}." });
        await db.SaveChangesAsync();
    }

    private async Task<List<Attachment>> LoadAttachmentsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Attachments.AsNoTracking().Where(row => row.PbiId == AdoId).OrderBy(row => row.Id).ToListAsync();
    }

    private async Task<List<LocalItem>> LoadTasksAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == AdoId).ToListAsync();
    }
}
