using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Cleanup.Cleaners;

// The per-tool trace of the vault's successful runs (`agent_usage.run_event`) past the buffer; `usage_record` (tokens,
// cost) and `agent_run` stay, so the statistics do. A run belongs to the vault through its PBI or its task.
public sealed class RunEventsCleaner(PowerLoomDbContext db) : IArtefactCleaner
{
    public const string StoreName = "run-events";

    public string Store => StoreName;

    public async Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation)
    {
        var cutoff = context.CutoffOf(context.Settings.RunEventDays);

        if (cutoff is null)
            return CleanerResult.Off;

        var due = await MeasureAsync(context.Vault, cutoff.Value, cancellation);

        if (due.Rows == 0)
            return new CleanerResult([]);

        var target = $"run_event rows of success runs ended before {cutoff.Value:yyyy-MM-dd}";

        if (context.DryRun)
            return new CleanerResult([CleanupAction.Planned(StoreName, target, due.Bytes)], $"{due.Rows} rows");

        var deleted = await DeleteAsync(context.Vault, cutoff.Value, cancellation);

        return new CleanerResult([CleanupAction.Removed(StoreName, target, due.Bytes)], $"{deleted} rows");
    }

    private async Task<RunEventsDue> MeasureAsync(string vault, DateTimeOffset cutoff, CancellationToken cancellation)
    {
        var rows = await db.Database.SqlQuery<RunEventsDue>($"""
            select count(*)::int as "Rows", coalesce(sum(pg_column_size(e.*)), 0)::bigint as "Bytes"
            from agent_usage.run_event e
            join agent_usage.usage_record r on r.run_id = e.run_id
            where r.outcome = 'success' and r.ended_at < {cutoff}
              and exists (select 1 from agent_run a left join work_item w on w.ado_id = a.pbi_id left join local_item i on i.id = a.item_id
                          where a.id::text = e.run_id and coalesce(w.vault, i.vault) = {vault})
            """).ToListAsync(cancellation);

        return rows.Single();
    }

    private Task<int> DeleteAsync(string vault, DateTimeOffset cutoff, CancellationToken cancellation) =>
        db.Database.ExecuteSqlAsync($"""
            delete from agent_usage.run_event e
            using agent_usage.usage_record r
            where r.run_id = e.run_id and r.outcome = 'success' and r.ended_at < {cutoff}
              and exists (select 1 from agent_run a left join work_item w on w.ado_id = a.pbi_id left join local_item i on i.id = a.item_id
                          where a.id::text = e.run_id and coalesce(w.vault, i.vault) = {vault})
            """, cancellation);
}
