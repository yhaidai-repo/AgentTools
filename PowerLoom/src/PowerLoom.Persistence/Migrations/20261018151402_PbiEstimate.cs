using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PbiEstimate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pbi_estimate",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    agent = table.Column<string>(type: "text", nullable: false),
                    human_hours = table.Column<decimal>(type: "numeric", nullable: false),
                    agent_hours = table.Column<decimal>(type: "numeric", nullable: true),
                    complexity = table.Column<short>(type: "smallint", nullable: true),
                    confidence = table.Column<string>(type: "text", nullable: true),
                    basis = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pbi_estimate_pkey", x => x.id);
                    table.CheckConstraint("pbi_estimate_complexity_ck", "complexity >= 1 AND complexity <= 5");
                    table.ForeignKey(
                        name: "pbi_estimate_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "pbi_estimate_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "pbi_estimate_pbi_idx",
                table: "pbi_estimate",
                columns: new[] { "pbi_id", "created_at" });

            // The estimates agents gave before record_estimate, as history: design's both values, refinement's developer
            // hours only (agent_hours null). Their old columns stay, no longer written.
            migrationBuilder.Sql("""
                INSERT INTO pbi_estimate (pbi_id, run_id, agent, human_hours, agent_hours, complexity, confidence, basis, created_at)
                SELECT pbi_id, run_id, 'design', est_human_h, est_agent_h, complexity, confidence, estimate_basis, created_at
                FROM design WHERE est_human_h IS NOT NULL;
                """);
            migrationBuilder.Sql("""
                INSERT INTO pbi_estimate (pbi_id, run_id, agent, human_hours, agent_hours, basis, created_at)
                SELECT pbi_id, run_id, CASE WHEN details IS NULL THEN 'refinement' ELSE 'better-refinement' END, est_hours, NULL, coalesce(estimate_basis, ''), created_at
                FROM refinement WHERE est_hours IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pbi_estimate");
        }
    }
}
