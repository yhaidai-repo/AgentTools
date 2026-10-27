using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261027081000_BugReportReceipts")]
public sealed class BugReportReceipts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE bug_report_receipt (
            request_id text PRIMARY KEY,
            request_hash text NOT NULL,
            ado_id integer NOT NULL
        );
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE bug_report_receipt;");
}
