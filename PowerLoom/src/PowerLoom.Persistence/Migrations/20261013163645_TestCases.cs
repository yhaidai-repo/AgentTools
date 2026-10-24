using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TestCases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "test_case",
                columns: table => new
                {
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    ado_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    state = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: true),
                    rev = table.Column<int>(type: "integer", nullable: false),
                    steps_md = table.Column<string>(type: "text", nullable: false),
                    parameters = table.Column<string>(type: "text", nullable: true),
                    fetched_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("test_case_pbi_id_ado_id_pk", x => new { x.pbi_id, x.ado_id });
                    table.ForeignKey(
                        name: "test_case_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "test_case");
        }
    }
}
