using System.Text;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.Connection.Models;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Documents;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Documents;

[Collection(PowerLoomCollection.Name)]
public sealed class LinkedDocumentsTests(PowerLoomHost host)
{
    private const string OrgUrl = "https://dev.azure.com/org";
    private const string Spec = $"{OrgUrl}/_apis/wit/attachments/aaa-111?fileName=spec.txt";
    private const string Expired = $"{OrgUrl}/_apis/wit/attachments/bbb-222?fileName=old.pdf";
    private const string WebPage = "https://example.org/rules";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    // A web page becomes the user's task only for an agent without web access (user decision 2026-10-14).
    [Fact]
    public async Task An_ado_attachment_is_stored_a_failed_download_becomes_the_users_task_and_a_web_page_only_when_asked_for()
    {
        const int adoId = 66001;
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.Downloads[Spec] = new AdoDownload("spec.txt", "text/plain", Encoding.UTF8.GetBytes("The spec says hello."));
        await host.Host.PutJson(new SaveConnectionRequest(true, OrgUrl, "Proj", "Team", "sam@x.io", "token-docs"), $"/api/vaults/{PowerLoomHost.Vault}/ado/connection").Receive<SavedConnection>();
        await SeedAsync(adoId);

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.InvokeAsync(new CollectLinkedDocuments(PowerLoomHost.Vault, adoId)));
        var attachments = await AttachmentsAsync(adoId);
        var tasks = await HumanTasksAsync(adoId);

        Assert.Single(session.Executed.MessagesOf<PbiChanged>());
        Assert.Equal([(Spec, "spec.txt", "The spec says hello.", AttachmentOrigin.Ado)], attachments.Select(row => (row.SourceUrl, row.FileName, row.Text, row.Origin)).ToList());
        Assert.Single(tasks);
        Assert.Contains(tasks, task => task.Title == "Attach the content of the linked ADO attachment" && task.Body!.Contains(Expired) && task.Body.Contains("PowerLoom couldn't fetch it: download failed (203 text/html)"));

        // Everything handled: a second collection changes nothing and renders nothing.
        var again = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.InvokeAsync(new CollectLinkedDocuments(PowerLoomHost.Vault, adoId)));

        Assert.Empty(again.Executed.MessagesOf<PbiChanged>());
        Assert.Single(await HumanTasksAsync(adoId));

        var asked = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.InvokeAsync(new CollectLinkedDocuments(PowerLoomHost.Vault, adoId, AskForWebPages: true)));
        var withWebPage = await HumanTasksAsync(adoId);

        Assert.Single(asked.Executed.MessagesOf<PbiChanged>());
        Assert.Equal(2, withWebPage.Count);
        Assert.Contains(withWebPage, task => task.Title == "Attach the content of the linked document" && task.Body!.Contains(WebPage) && task.Body.Contains("Agents can't open it"));
    }

    [Fact]
    public async Task A_web_page_holds_only_an_agent_without_web_access_and_its_anchors_are_one_document()
    {
        const int adoId = 66002;
        var task = await SeedResearchTaskAsync(adoId, "Read https://example.org/guide#part-1 and https://example.org/guide#Part-2.");

        var withWeb = await ReasonsAsync(task, webAccess: true);
        var withoutWeb = await ReasonsAsync(task, webAccess: false);

        Assert.Empty(withWeb);
        Assert.Equal(["Linked document without content: https://example.org/guide"], withoutWeb);
    }

    private async Task<LocalItem> SeedResearchTaskAsync(int adoId, string description)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = new LocalItem { Id = $"AT-{adoId}-001", Kind = ItemKind.Research, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" };

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.NeedsResearch, SyncedAt = DateTime.UtcNow, DescriptionMd = description });
        db.LocalItems.Add(task);
        await db.SaveChangesAsync();

        return task;
    }

    private async Task<List<string>> ReasonsAsync(LocalItem task, bool webAccess)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await TaskValidation.ValidateAsync(db, task, "research", [TaskValidation.LinkedDocuments], webAccess, CancellationToken.None);
    }

    private async Task SeedAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = $"PBI {adoId}", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.ReadyForRefinement, SyncedAt = DateTime.UtcNow, DescriptionMd = $"See {Spec} and {WebPage}.", AcceptanceCriteriaMd = $"Old: {Expired}" });
        await db.SaveChangesAsync();
    }

    private async Task<List<Attachment>> AttachmentsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().Attachments.AsNoTracking().Where(row => row.PbiId == adoId).ToListAsync();
    }

    private async Task<List<LocalItem>> HumanTasksAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId && item.Kind == ItemKind.Human).ToListAsync();
    }
}
