using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    // Every result written before run_result existed becomes a run result too (user decision 2026-10-22: results follow
    // one pattern and are never lost): research results and test reports, refinement and design versions, and the
    // resolution a run wrote onto its task. The old rows stay; their readers are unchanged. Runs that already have a
    // result are skipped, so the backfill can run again.
    /// <inheritdoc />
    public partial class RunResultBackfill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO run_result (run_id, task_id, pbi_id, agent, status, body, data, created_at)
                SELECT li.created_by_run, li.parent_id, li.pbi_id,
                       coalesce(ar.stage::text, nullif(split_part(li.assignee, ':', 2), ''), 'agent'),
                       CASE WHEN coalesce(li.data->>'status', li.data->'report'->>'status') IN ('complete', 'partial', 'blocked') THEN coalesce(li.data->>'status', li.data->'report'->>'status')
                            WHEN li.data->>'status' = 'not_found' THEN 'partial'
                            ELSE 'complete' END,
                       coalesce(nullif(li.body, ''), li.title), li.data, li.created_at
                FROM local_item li
                LEFT JOIN agent_run ar ON ar.id = li.created_by_run
                WHERE li.kind IN ('research-result', 'test-report') AND li.status <> 'deleted'
                  AND (li.created_by_run IS NULL OR NOT EXISTS (SELECT 1 FROM run_result rr WHERE rr.run_id = li.created_by_run));
                """);

            migrationBuilder.Sql("""
                INSERT INTO run_result (run_id, task_id, pbi_id, agent, status, body, data, created_at)
                SELECT r.run_id, ar.item_id, r.pbi_id, coalesce(ar.stage::text, 'refinement'), 'complete',
                       '# Refinement v' || r.version || E'\n\n' || r.summary,
                       jsonb_build_object('version', r.version, 'scopeIn', r.scope_in, 'scopeOut', r.scope_out, 'acGaps', r.ac_gaps,
                                          'dependencies', r.dependencies, 'repos', r.repos, 'assumptions', r.assumptions,
                                          'relevantDocs', r.relevant_docs, 'skills', r.skills, 'details', r.details),
                       r.created_at
                FROM refinement r
                LEFT JOIN agent_run ar ON ar.id = r.run_id
                WHERE r.run_id IS NULL OR NOT EXISTS (SELECT 1 FROM run_result rr WHERE rr.run_id = r.run_id);
                """);

            migrationBuilder.Sql("""
                INSERT INTO run_result (run_id, task_id, pbi_id, agent, status, body, data, created_at)
                SELECT d.run_id, ar.item_id, d.pbi_id, coalesce(ar.stage::text, 'design'), 'complete',
                       '# Design v' || d.version || E'\n\n' || d.approach,
                       jsonb_build_object('version', d.version, 'alternatives', d.alternatives, 'plan', d.plan, 'risks', d.risks,
                                          'tests', d.tests, 'assumptions', d.assumptions),
                       d.created_at
                FROM design d
                LEFT JOIN agent_run ar ON ar.id = d.run_id
                WHERE d.run_id IS NULL OR NOT EXISTS (SELECT 1 FROM run_result rr WHERE rr.run_id = d.run_id);
                """);

            // A task's resolution as the result of its last successful run; a task closed by a person has no such run.
            migrationBuilder.Sql("""
                INSERT INTO run_result (run_id, task_id, pbi_id, agent, status, body, created_at)
                SELECT last.id, li.id, li.pbi_id, last.stage::text, 'complete', li.resolution, coalesce(li.closed_at, li.updated_at)
                FROM local_item li
                JOIN LATERAL (
                    SELECT ar.id, ar.stage FROM agent_run ar
                    WHERE ar.item_id = li.id AND ar.outcome = 'success'
                    ORDER BY ar.id DESC LIMIT 1
                ) last ON true
                WHERE li.resolution IS NOT NULL AND li.assignee LIKE 'agent:%' AND li.status <> 'deleted'
                  AND NOT EXISTS (SELECT 1 FROM run_result rr WHERE rr.run_id = last.id);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfilled rows can't be told from rows written since; the RunResults migration's Down drops the table.
        }
    }
}
