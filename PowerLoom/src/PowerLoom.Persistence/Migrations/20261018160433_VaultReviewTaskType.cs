using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class VaultReviewTaskType : Migration
    {
        // Every schedule is by task type (user decision 2026-10-18): the vault review becomes a `vault-review` task for any
        // agent that takes it, and a goal schedule a research task without a PBI (its goal is the description and, as
        // research reads its goal from them, the acceptance criteria). Name, vault, cron and enabled stay.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE task_schedule
                SET task_type = 'vault-review',
                    agent_id = '*',
                    params = jsonb_build_object(
                        'description', 'Review the vault: decide each stale or unlinked note, fix invalid links, and close or keep each open WWW/KI/OQ record.',
                        'acceptanceCriteria', 'Each candidate taken this run has a decision with its reasons; the summary lists what changed and what is left.',
                        'pbiId', NULL,
                        'repos', '[]'::jsonb),
                    updated_at = now()
                WHERE task_type IS NULL AND agent_id = 'vault-review';
                """);
            migrationBuilder.Sql("""
                UPDATE task_schedule
                SET task_type = 'research',
                    agent_id = '*',
                    params = jsonb_build_object(
                        'description', params->>'goal',
                        'acceptanceCriteria', params->>'goal',
                        'pbiId', NULL,
                        'repos', COALESCE(params->'repos', '[]'::jsonb)),
                    updated_at = now()
                WHERE task_type IS NULL;
                """);
        }

        // Only the vault review goes back: a converted goal schedule can't be told from a research schedule.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE task_schedule
                SET task_type = NULL, agent_id = 'vault-review', params = '{}'::jsonb, updated_at = now()
                WHERE task_type = 'vault-review';
                """);
        }
    }
}
