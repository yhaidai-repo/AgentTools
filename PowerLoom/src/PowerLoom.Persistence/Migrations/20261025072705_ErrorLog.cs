using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ErrorLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "log_entry",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    service = table.Column<string>(type: "text", nullable: false),
                    level = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    fingerprint = table.Column<string>(type: "text", nullable: false),
                    count = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    first_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    last_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    task_id = table.Column<string>(type: "text", nullable: true),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    vault = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("log_entry_pkey", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "log_entry_fingerprint_uq",
                table: "log_entry",
                column: "fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "log_entry_last_at_idx",
                table: "log_entry",
                column: "last_at");

            migrationBuilder.CreateIndex(
                name: "log_entry_run_idx",
                table: "log_entry",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "log_entry_task_idx",
                table: "log_entry",
                column: "task_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "log_entry");
        }
    }
}
