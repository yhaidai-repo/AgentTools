using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.ImportSources.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// One run over the vault's import sources (user decision 2026-10-02): each waiting item's PBIs are synced, the new
// ones prepared when the item says so, and the source is told how it went. At most maxItemsPerRun items over all
// sources; the rest wait for the next run.
public sealed class ImportSync(PowerLoomDbContext db, IEnumerable<IPbiImportSource> sources, ImportSettingsStore settings, SinglePbiSync singleSync, SyncBookkeeping bookkeeping, IMessageBus bus, Microsoft.Extensions.Options.IOptions<ImportOptions> options)
{
    private const string Actor = "import";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Statuses a PBI has before it's prepared (or after ADO content changed); any other status means it's in the
    // pipeline, and an import must not start a re-refinement (assumption, 2026-10-02).
    private static readonly PipelineStatus[] Preparable = [PipelineStatus.New, PipelineStatus.Stale];

    public async Task<SyncOutcome> RunAsync(string vault, AdoSettings ado, IAdoClient client, long runId, CancellationToken cancellation)
    {
        var checkedAt = DateTime.UtcNow.ToString("O");

        if (string.IsNullOrWhiteSpace(options.Value.InboxRoot))
        {
            await settings.SaveStatusAsync(vault, new ImportRunStatus(false, checkedAt, []), cancellation);

            return new SyncOutcome(RunOutcome.NoOp, "Import:InboxRoot is not set");
        }

        var messages = await ImportFromSourcesAsync(vault, ado, client, runId, cancellation);
        var statuses = new List<ImportSourceStatus>();

        foreach (var source in sources)
            statuses.Add(await source.StatusAsync(vault, cancellation));

        await settings.SaveStatusAsync(vault, new ImportRunStatus(true, checkedAt, statuses), cancellation);

        return new SyncOutcome(RunOutcome.Success, messages.Count > 0 ? string.Join("; ", messages) : "nothing waiting");
    }

    private async Task<List<string>> ImportFromSourcesAsync(string vault, AdoSettings ado, IAdoClient client, long runId, CancellationToken cancellation)
    {
        var max = (await settings.ReadAsync(vault, cancellation)).MaxItemsPerRun;
        var messages = new List<string>();

        foreach (var source in sources)
        {
            var pending = await source.ReadPendingAsync(vault, max - messages.Count, cancellation);

            foreach (var item in pending)
                messages.Add($"{item.Label}: {await ImportOneAsync(vault, ado, client, runId, item, cancellation)}");
        }

        return messages;
    }

    private async Task<string> ImportOneAsync(string vault, AdoSettings ado, IAdoClient client, long runId, PendingImport item, CancellationToken cancellation)
    {
        if (!item.Request.Ok)
        {
            await item.Reject(item.Request.Problem!.Detail, cancellation);

            return $"set aside: {item.Request.Problem.Detail}";
        }

        var summary = await ImportPbisAsync(vault, ado, client, runId, item.Request.Value!, cancellation);

        await item.Complete(cancellation);

        return summary;
    }

    // Same source + sourceRef imported before without failures → nothing done (re-sent items are harmless).
    private async Task<string> ImportPbisAsync(string vault, AdoSettings ado, IAdoClient client, long runId, PbiImportRequest request, CancellationToken cancellation)
    {
        var previous = await db.PbiImports.SingleOrDefaultAsync(row => row.Source == request.Source && row.SourceRef == request.SourceRef, cancellation);

        if (previous is not null && !HasFailed(previous.Results))
            return "imported before";

        var ids = (request.AdoIds ?? []).Concat(PbiLinks.Extract(ado, request.Html, request.Text)).Distinct().ToList();
        var synced = await SyncAllAsync(vault, client, runId, ids, cancellation);
        var results = request.Prepare == false ? synced : await PrepareNewAsync(vault, synced, cancellation);

        await SaveImportAsync(previous, vault, request, results, cancellation);

        return Summary(results);
    }

    // PBIs deleted in adoa stay deleted (assumption, 2026-10-02): only Sync PBI on the Backlog brings one back. One PBI
    // failing (not in ADO, no access) doesn't stop the others; one already started in ADO is refused.
    private async Task<List<PbiImportResult>> SyncAllAsync(string vault, IAdoClient client, long runId, List<int> ids, CancellationToken cancellation)
    {
        var deleted = await bookkeeping.DeletedPbiIdsAsync(cancellation);
        var results = new List<PbiImportResult>();

        foreach (var adoId in ids)
            results.Add(deleted.Contains(adoId) ? new PbiImportResult(adoId, PbiImportResult.Deleted) : await SyncOneAsync(vault, client, runId, adoId, cancellation));

        return results;
    }

    private async Task<PbiImportResult> SyncOneAsync(string vault, IAdoClient client, long runId, int adoId, CancellationToken cancellation)
    {
        try
        {
            var synced = await singleSync.FetchAndStoreAsync(vault, adoId, client, runId, onlyNotStarted: true, cancellation);

            return synced.Ok ? new PbiImportResult(adoId, PbiImportResult.Synced) : new PbiImportResult(adoId, PbiImportResult.Refused, synced.Problem!.Detail);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return new PbiImportResult(adoId, PbiImportResult.Failed, error.Message);
        }
    }

    // The new PBIs go to Prepare (their notes and refinement task follow on the vault's queue); the others are left
    // alone.
    private async Task<List<PbiImportResult>> PrepareNewAsync(string vault, List<PbiImportResult> results, CancellationToken cancellation)
    {
        var syncedIds = results.Where(result => result.Outcome == PbiImportResult.Synced).Select(result => result.AdoId).ToList();
        var preparable = (await db.WorkItems.AsNoTracking().Where(row => syncedIds.Contains(row.AdoId) && Preparable.Contains(row.PipelineStatus)).Select(row => row.AdoId).ToListAsync(cancellation)).ToHashSet();

        foreach (var adoId in preparable)
            await bus.PublishAsync(new PreparePbi(vault, adoId, Actor));

        return results.Select(result => result.Outcome != PbiImportResult.Synced ? result : result with { Outcome = preparable.Contains(result.AdoId) ? PbiImportResult.Prepared : PbiImportResult.InPipeline }).ToList();
    }

    // A re-sent item with a failed PBI is imported again; its row is updated with the new results.
    private async Task SaveImportAsync(PbiImport? previous, string vault, PbiImportRequest request, List<PbiImportResult> results, CancellationToken cancellation)
    {
        var row = previous ?? db.PbiImports.Add(new PbiImport { Source = request.Source, SourceRef = request.SourceRef }).Entity;

        row.Vault = vault;
        row.Title = request.Title;
        row.Sender = request.From;
        row.OccurredAt = request.OccurredAt is null ? null : DateTimeOffset.Parse(request.OccurredAt, null, System.Globalization.DateTimeStyles.AssumeUniversal).UtcDateTime;
        row.Results = JsonSerializer.Serialize(results, Json);
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }

    private static bool HasFailed(string results) => JsonSerializer.Deserialize<List<PbiImportResult>>(results, Json)?.Any(result => result.Outcome == PbiImportResult.Failed) == true;

    // "4 PBI(s): 2 prepared, 1 in-pipeline, 1 failed", or "no PBI links".
    private static string Summary(List<PbiImportResult> results)
    {
        if (results.Count == 0)
            return "no PBI links";

        var parts = results.GroupBy(result => result.Outcome).Select(group => $"{group.Count()} {group.Key}");

        return $"{results.Count} PBI(s): {string.Join(", ", parts)}";
    }
}
