using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RunResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "run_result",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    task_id = table.Column<string>(type: "text", nullable: true),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    agent = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    data = table.Column<string>(type: "jsonb", nullable: true),
                    evidence = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("run_result_pkey", x => x.id);
                    table.ForeignKey(
                        name: "run_result_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "run_result_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "run_result_task_id_local_item_id_fk",
                        column: x => x.task_id,
                        principalTable: "local_item",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "run_result_pbi_idx",
                table: "run_result",
                columns: new[] { "pbi_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "run_result_run_uq",
                table: "run_result",
                column: "run_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "run_result_task_idx",
                table: "run_result",
                columns: new[] { "task_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "run_result");
        }
    }
}
