using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// One PBI by id, from any sprint, in any state (user decision 2026-10-02). Like every PBI in PowerLoom, full syncs refresh
// it from now on; a PBI deleted in PowerLoom comes back. A known PBI stays in its vault; a new one joins the given vault.
// With `onlyNotStarted` (imports), a new PBI already started in ADO is refused.
public sealed class SinglePbiSync(PowerLoomDbContext db, WorkItemStore store, SyncBookkeeping bookkeeping)
{
    public async Task<string?> VaultOfAsync(int adoId, CancellationToken cancellation)
    {
        return await db.WorkItems.AsNoTracking().Where(item => item.AdoId == adoId).Select(item => item.Vault).SingleOrDefaultAsync(cancellation);
    }

    public async Task<SyncOutcome> RunAsync(string vault, int adoId, IAdoClient client, long runId, CancellationToken cancellation)
    {
        var synced = await FetchAndStoreAsync(vault, adoId, client, runId, onlyNotStarted: false, cancellation);

        return new SyncOutcome(RunOutcome.Success, synced.Value!);
    }

    public async Task<Outcome<string>> FetchAndStoreAsync(string vault, int adoId, IAdoClient client, long runId, bool onlyNotStarted, CancellationToken cancellation)
    {
        var item = (await client.GetWorkItemsAsync([adoId], AdoFields.Sync, cancellation)).FirstOrDefault()
            ?? throw new InvalidOperationException($"PBI {adoId} isn't in Azure DevOps, or the token can't see it");
        var mapped = WorkItemMapper.Map(item);

        if (onlyNotStarted && !EntryRule.CanEnter(mapped.AdoState) && await VaultOfAsync(adoId, cancellation) is null)
            return Outcome<string>.Failure(Problem.Conflict(EntryRule.Refusal(adoId, mapped.AdoState)));

        await bookkeeping.ForgetDeletedPbiAsync(adoId, cancellation);
        await store.UpsertAsync(vault, runId, mapped, cancellation);

        return Outcome<string>.Success($"PBI-{adoId} synced");
    }
}
