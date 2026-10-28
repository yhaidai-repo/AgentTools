using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261028090000_RunFailureReports")]
public sealed class RunFailureReports : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE run_failure_report (
            id serial PRIMARY KEY,
            vault text NOT NULL REFERENCES vault(name),
            origin text NOT NULL DEFAULT 'run',
            agent_id text NOT NULL,
            actor text NULL,
            run_id bigint NULL,
            task_id text NULL,
            pbi_id integer NULL,
            kind text NOT NULL,
            tool text NULL,
            target text NOT NULL,
            saw text NOT NULL,
            workaround text NOT NULL,
            instead text NULL,
            impact text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX run_failure_report_vault_created_idx ON run_failure_report (vault, created_at);
        CREATE INDEX run_failure_report_kind_tool_created_idx ON run_failure_report (kind, tool, created_at);
        CREATE INDEX run_failure_report_run_idx ON run_failure_report (run_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE run_failure_report;");
}
