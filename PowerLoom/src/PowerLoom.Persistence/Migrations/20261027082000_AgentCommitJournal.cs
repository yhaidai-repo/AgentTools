using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261027082000_AgentCommitJournal")]
public sealed class AgentCommitJournal : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE agent_run ADD COLUMN commit_root_run_id bigint NULL;
        ALTER TABLE agent_run ADD COLUMN commit_started_at timestamptz NULL;
        ALTER TABLE agent_run ADD COLUMN commit_completed_at timestamptz NULL;
        CREATE TABLE agent_commit_step (
            root_run_id bigint NOT NULL,
            step_key text NOT NULL,
            result jsonb NOT NULL,
            PRIMARY KEY(root_run_id, step_key)
        );
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE agent_commit_step;
        ALTER TABLE agent_run DROP COLUMN commit_root_run_id, DROP COLUMN commit_started_at, DROP COLUMN commit_completed_at;
        """);
}
