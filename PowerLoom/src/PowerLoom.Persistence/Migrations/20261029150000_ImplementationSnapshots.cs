using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

// The implementation agent (wave 3, user decisions 2026-10-28/29): each write_implementation stores a version of the
// PBI's implementation with the `gsd-tools planning inspect` snapshot it was read from (schema_version 1 only, like the
// plan's) and the plan version it executed. A plan keeps the PBI's content hash it was made from, so implementation can
// tell that the PBI changed after the review.
[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261029150000_ImplementationSnapshots")]
public sealed class ImplementationSnapshots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE planning_snapshot ADD COLUMN pbi_content_hash text NULL;
        CREATE TABLE implementation_snapshot (
            id serial PRIMARY KEY,
            pbi_id integer NOT NULL REFERENCES work_item(ado_id),
            version integer NOT NULL,
            schema_version smallint NOT NULL CHECK (schema_version = 1),
            inspect jsonb NOT NULL,
            build jsonb NOT NULL,
            plan_version integer NULL,
            run_id bigint NULL REFERENCES agent_run(id),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX implementation_snapshot_pbi_version_uq ON implementation_snapshot (pbi_id, version);
        CREATE INDEX implementation_snapshot_run_idx ON implementation_snapshot (run_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE implementation_snapshot;
        ALTER TABLE planning_snapshot DROP COLUMN pbi_content_hash;
        """);
}
