using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DataAccessLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "data_access",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    vault = table.Column<string>(type: "text", nullable: false),
                    agent_id = table.Column<string>(type: "text", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: false),
                    task_id = table.Column<string>(type: "text", nullable: true),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    tool = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    resource = table.Column<string>(type: "text", nullable: false),
                    target = table.Column<string>(type: "text", nullable: false),
                    request = table.Column<string>(type: "text", nullable: false),
                    outcome = table.Column<string>(type: "text", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: true),
                    rows = table.Column<int>(type: "integer", nullable: true),
                    bytes = table.Column<int>(type: "integer", nullable: true),
                    truncated = table.Column<bool>(type: "boolean", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("data_access_pkey", x => x.id);
                    table.ForeignKey(
                        name: "data_access_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateIndex(
                name: "data_access_resource_started_idx",
                table: "data_access",
                columns: new[] { "resource", "started_at" });

            migrationBuilder.CreateIndex(
                name: "data_access_run_idx",
                table: "data_access",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "data_access_vault_started_idx",
                table: "data_access",
                columns: new[] { "vault", "started_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "data_access");
        }
    }
}
