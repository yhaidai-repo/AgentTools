using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PullRequestOrigin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: the drizzle adoption test rewinds the history and applies the migrations again.
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS local_pr_id START WITH 9000001;");
            migrationBuilder.Sql("ALTER TABLE pull_request ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'sync';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE pull_request DROP COLUMN IF EXISTS origin;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS local_pr_id;");
        }
    }
}
