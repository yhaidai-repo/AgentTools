using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CodeReviewVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "code_review_version",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pr_id = table.Column<int>(type: "integer", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    reviewed_commit = table.Column<string>(type: "text", nullable: false),
                    reviewed_iteration = table.Column<int>(type: "integer", nullable: true),
                    summary_md = table.Column<string>(type: "text", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("code_review_version_pkey", x => x.id);
                    table.ForeignKey(
                        name: "code_review_version_pr_id_pull_request_id_fk",
                        column: x => x.pr_id,
                        principalTable: "pull_request",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "code_review_version_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "code_review_version_pr_idx",
                table: "code_review_version",
                columns: new[] { "pr_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "code_review_version_run_uq",
                table: "code_review_version",
                column: "run_id",
                unique: true);

            // Each review's latest summary as the version of its latest successful review run; earlier runs kept none and
            // show their comments only.
            migrationBuilder.Sql("""
                INSERT INTO code_review_version (pr_id, run_id, reviewed_commit, reviewed_iteration, summary_md, details, created_at)
                SELECT cr.pr_id, latest.id, cr.reviewed_commit, cr.reviewed_iteration, cr.summary_md, cr.details, coalesce(cr.reviewed_at, cr.updated_at)
                FROM code_review cr
                CROSS JOIN LATERAL (
                    SELECT ar.id FROM agent_run ar JOIN local_item li ON li.id = ar.item_id
                    WHERE li.kind = 'review' AND li.data->>'prId' = cr.pr_id::text AND ar.outcome = 'success'
                    ORDER BY ar.id DESC LIMIT 1
                ) latest
                WHERE cr.reviewed_commit IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "code_review_version");
        }
    }
}
