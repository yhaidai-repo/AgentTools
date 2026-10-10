using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Api.Tests.Ado;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;
using PowerLoom.Features.ImportSources.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Settings;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.ImportSources;

[Collection(PowerLoomCollection.Name)]
public sealed class ImportSyncTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Each_waiting_item_is_imported_its_new_pbis_prepared_and_the_source_told()
    {
        await ConfigureAsync();
        var ado = host.Host.Services.GetRequiredService<FakeAdoClientFactory>().Client;

        ado.WorkItems.Add(WorkItemMapperTests.Item(52001, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"From the inbox","System.State":"New","System.IterationPath":"proj\\Sprint 9"}"""));
        ado.WorkItems.Add(WorkItemMapperTests.Item(52002, 1, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Started already","System.State":"Active"}"""));
        Directory.CreateDirectory(Path.Combine(host.ImportRoot, "outlook"));
        await File.WriteAllTextAsync(Path.Combine(host.ImportRoot, "req-52001.json"), """{"source":"inbox","adoIds":[52001]}""");
        await File.WriteAllTextAsync(Path.Combine(host.ImportRoot, "outlook", "mail-1.json"), """{"entryId":"e1","internetMessageId":"<m1@x>","subject":"Please look","sender":"pat@x.io","received":"2026-10-01T10:00:00Z","html":"<a href=\"https://dev.azure.com/org/proj/_workitems/edit/52002\">PBI</a>"}""");
        await File.WriteAllTextAsync(Path.Combine(host.ImportRoot, "outlook", "broken.json"), "{not json");

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new SyncPbis(PowerLoomHost.Vault, null, SyncSources.Imports)).AsTask());
        var imports = await LoadImportsAsync();

        Assert.Equal(52001, session.Executed.SingleMessage<PreparePbi>().AdoId);
        Assert.Equal([new PbiImportResult(52001, "prepared")], Results(imports["req-52001.json"]));
        Assert.Equal([new PbiImportResult(52002, "refused", "PBI-52002 is Active in Azure DevOps; only New or Ready for Dev PBIs enter adoa")], Results(imports["<m1@x>"]));
        Assert.Equal(("Please look", "pat@x.io"), (imports["<m1@x>"].Title, imports["<m1@x>"].Sender));
        Assert.False(File.Exists(Path.Combine(host.ImportRoot, "req-52001.json")));
        Assert.False(File.Exists(Path.Combine(host.ImportRoot, "outlook", "mail-1.json")));
        Assert.Equal("Not valid JSON", (await File.ReadAllTextAsync(Path.Combine(host.ImportRoot, "outlook", "failed", "broken.json.reason.txt")))[..14]);
        Assert.Equal(PipelineStatus.ReadyForRefinement, await StatusAsync(52001));
        Assert.Contains(new ImportSourceStatus("outlook", 0, 1), (await ImportStatusAsync()).Sources);
        Assert.False(await ExistsAsync(52002));
    }

    private async Task ConfigureAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<AdoSettingsStore>();

        await store.SaveAdoAsync(PowerLoomHost.Vault, new AdoSettings { Enabled = true, OrgUrl = "https://dev.azure.com/org", Project = "proj", Team = "Team", User = "sam@x.io", Pat = "token" }, CancellationToken.None);
    }

    private async Task<Dictionary<string, PbiImport>> LoadImportsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().PbiImports.AsNoTracking().Where(row => row.Vault == PowerLoomHost.Vault).ToDictionaryAsync(row => row.SourceRef);
    }

    private async Task<PipelineStatus> StatusAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.PipelineStatus).SingleAsync();
    }

    private async Task<bool> ExistsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AnyAsync(row => row.AdoId == adoId);
    }

    private async Task<ImportRunStatus> ImportStatusAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return (await VaultSettings.ReadAsync<ImportRunStatus>(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), PowerLoomHost.Vault, "importStatus", CancellationToken.None))!;
    }

    private static List<PbiImportResult> Results(PbiImport row) => JsonSerializer.Deserialize<List<PbiImportResult>>(row.Results, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
}
