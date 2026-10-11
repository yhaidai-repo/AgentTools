using System.Text;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.Connection.Models;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Documents;
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

    [Fact]
    public async Task An_ado_attachment_is_stored_and_a_web_page_or_failed_download_becomes_the_users_task()
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
        Assert.Equal(2, tasks.Count);
        Assert.Contains(tasks, task => task.Title == "Attach the content of the linked document" && task.Body!.Contains(WebPage) && task.Body.Contains("Agents can't open it"));
        Assert.Contains(tasks, task => task.Title == "Attach the content of the linked ADO attachment" && task.Body!.Contains(Expired) && task.Body.Contains("adoa couldn't fetch it: download failed (203 text/html)"));

        // Everything handled: a second collection changes nothing and renders nothing.
        var again = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(context => context.InvokeAsync(new CollectLinkedDocuments(PowerLoomHost.Vault, adoId)));

        Assert.Empty(again.Executed.MessagesOf<PbiChanged>());
        Assert.Equal(2, (await HumanTasksAsync(adoId)).Count);
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
