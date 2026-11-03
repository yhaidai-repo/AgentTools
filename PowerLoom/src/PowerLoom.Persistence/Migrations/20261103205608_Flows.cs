using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Flows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "flow",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    vault = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    definition = table.Column<string>(type: "jsonb", nullable: false),
                    trigger = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("flow_pkey", x => x.id);
                    table.ForeignKey(
                        name: "flow_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "flow_execution",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    flow_id = table.Column<string>(type: "text", nullable: false),
                    flow_version = table.Column<int>(type: "integer", nullable: false),
                    definition = table.Column<string>(type: "jsonb", nullable: false),
                    vault = table.Column<string>(type: "text", nullable: false),
                    target_kind = table.Column<string>(type: "text", nullable: false),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    item_id = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("flow_execution_pkey", x => x.id);
                    table.ForeignKey(
                        name: "flow_execution_flow_id_flow_id_fk",
                        column: x => x.flow_id,
                        principalTable: "flow",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "flow_vault_name_key",
                table: "flow",
                columns: new[] { "vault", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "flow_execution_vault_started_idx",
                table: "flow_execution",
                columns: new[] { "vault", "started_at" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "flow_execution");

            migrationBuilder.DropTable(
                name: "flow");
        }
    }
}
