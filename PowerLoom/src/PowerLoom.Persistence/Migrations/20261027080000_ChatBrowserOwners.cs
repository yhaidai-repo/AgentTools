using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261027080000_ChatBrowserOwners")]
public sealed class ChatBrowserOwners : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE chat_browser_owner (
            owner text PRIMARY KEY,
            vault text NOT NULL REFERENCES vault(name),
            expires_at timestamptz NOT NULL,
            closed_at timestamptz NULL
        );
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE chat_browser_owner;");
}
