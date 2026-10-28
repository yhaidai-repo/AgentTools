using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

// The planning agent replaces design (user decision 2026-10-28): each write_plan stores a version of the PBI's plan with
// the `gsd-tools planning inspect` snapshot it was read from. Only inspect's schema_version 1 is understood, so the
// database refuses any other.
[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261029120000_PlanningSnapshots")]
public sealed class PlanningSnapshots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE planning_snapshot (
            id serial PRIMARY KEY,
            pbi_id integer NOT NULL REFERENCES work_item(ado_id),
            version integer NOT NULL,
            schema_version smallint NOT NULL CHECK (schema_version = 1),
            inspect jsonb NOT NULL,
            plan jsonb NOT NULL,
            run_id bigint NULL REFERENCES agent_run(id),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX planning_snapshot_pbi_version_uq ON planning_snapshot (pbi_id, version);
        CREATE INDEX planning_snapshot_run_idx ON planning_snapshot (run_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE planning_snapshot;");
}
