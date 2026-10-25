using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GitHubRepoKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: a value can't be dropped from a PostgreSQL enum, so a database rewound to an earlier
            // migration (the drizzle adoption test) still has it.
            migrationBuilder.Sql("ALTER TYPE repo_kind ADD VALUE IF NOT EXISTS 'github';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // A PostgreSQL enum value can't be dropped; rows using it would have to go first.
        }
    }
}
