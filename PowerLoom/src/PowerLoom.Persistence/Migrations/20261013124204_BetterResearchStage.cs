using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BetterResearchStage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: a value can't be dropped from a PostgreSQL enum, so a database rewound to an earlier
            // migration (the drizzle adoption test) still has it.
            migrationBuilder.Sql("ALTER TYPE stage ADD VALUE IF NOT EXISTS 'better-research';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL can't drop an enum value; runs of this stage keep it.
        }
    }
}
