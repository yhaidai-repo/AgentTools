using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BetterReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: a value can't be dropped from a PostgreSQL enum, so a database rewound to an earlier
            // migration (the drizzle adoption test) still has them.
            migrationBuilder.Sql("ALTER TYPE stage ADD VALUE IF NOT EXISTS 'better-review';");
            migrationBuilder.Sql("ALTER TYPE review_comment_status ADD VALUE IF NOT EXISTS 'fixed';");

            migrationBuilder.AddColumn<string>(
                name: "category",
                table: "review_comment",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                table: "code_review",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "category",
                table: "review_comment");

            migrationBuilder.DropColumn(
                name: "details",
                table: "code_review");

            // PostgreSQL can't drop an enum value; runs of this stage and fixed comments keep theirs.
        }
    }
}
