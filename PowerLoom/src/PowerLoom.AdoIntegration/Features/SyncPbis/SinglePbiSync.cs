using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// One PBI by id, from any sprint, in any state (user decision 2026-10-02). Like every PBI in adoa, full syncs refresh
// it from now on; a PBI deleted in adoa comes back. A known PBI stays in its vault; a new one joins the given vault.
public sealed class SinglePbiSync(PowerLoomDbContext db, WorkItemStore store, SyncBookkeeping bookkeeping)
{
    public async Task<string?> VaultOfAsync(int adoId, CancellationToken cancellation)
    {
        return await db.WorkItems.AsNoTracking().Where(item => item.AdoId == adoId).Select(item => item.Vault).SingleOrDefaultAsync(cancellation);
    }

    public async Task<SyncOutcome> RunAsync(string vault, int adoId, IAdoClient client, long runId, CancellationToken cancellation)
    {
        var item = (await client.GetWorkItemsAsync([adoId], AdoFields.Sync, cancellation)).FirstOrDefault()
            ?? throw new InvalidOperationException($"PBI {adoId} isn't in Azure DevOps, or the token can't see it");

        await bookkeeping.ForgetDeletedPbiAsync(adoId, cancellation);
        await store.UpsertAsync(vault, runId, WorkItemMapper.Map(item), cancellation);

        return new SyncOutcome(RunOutcome.Success, $"PBI-{adoId} synced");
    }
}
