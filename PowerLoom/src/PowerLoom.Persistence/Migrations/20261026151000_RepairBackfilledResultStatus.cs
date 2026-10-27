using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261026151000_RepairBackfilledResultStatus")]
public sealed class RepairBackfilledResultStatus : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Restrict to rows copied from the legacy result/report items by the backfill. Later run results
        // and legitimate complete results must not be changed, even when they contain nested status fields.
        migrationBuilder.Sql("""
            UPDATE run_result rr SET status =
                CASE WHEN coalesce(li.data->>'status', li.data->'result'->>'status', li.data->'report'->>'status') = 'not_found'
                     THEN 'partial'
                     ELSE coalesce(li.data->>'status', li.data->'result'->>'status', li.data->'report'->>'status') END
            FROM local_item li
            WHERE li.kind IN ('research-result', 'test-report') AND li.status <> 'deleted'
              AND rr.status = 'complete' AND rr.data = li.data
              AND rr.run_id IS NOT DISTINCT FROM li.created_by_run
              AND rr.task_id IS NOT DISTINCT FROM li.parent_id
              AND rr.pbi_id IS NOT DISTINCT FROM li.pbi_id
              AND rr.created_at = li.created_at AND rr.body = coalesce(nullif(li.body, ''), li.title)
              AND coalesce(li.data->>'status', li.data->'result'->>'status', li.data->'report'->>'status') IN ('partial', 'blocked', 'not_found');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Restoring incorrectly labelled results would lose the correction.
    }
}
