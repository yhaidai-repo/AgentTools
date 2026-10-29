using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261029120000_ApplicationPerformance")]
public sealed class ApplicationPerformance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE application_metric_sample (
            minute timestamptz NOT NULL,
            instance_id uuid NOT NULL,
            requests bigint NOT NULL CHECK (requests >= 0),
            duration_ms double precision NOT NULL CHECK (duration_ms >= 0),
            working_set_bytes bigint NULL CHECK (working_set_bytes >= 0),
            PRIMARY KEY (minute, instance_id)
        );
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE application_metric_sample;");
}
