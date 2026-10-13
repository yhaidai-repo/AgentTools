using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BetterRefinement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: a value can't be dropped from a PostgreSQL enum, so a database rewound to an earlier
            // migration (the drizzle adoption test) still has it.
            migrationBuilder.Sql("ALTER TYPE stage ADD VALUE IF NOT EXISTS 'better-refinement';");

            migrationBuilder.AddColumn<string>(
                name: "details",
                table: "refinement",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL can't drop an enum value; runs of this stage keep it.
            migrationBuilder.DropColumn(
                name: "details",
                table: "refinement");
        }
    }
}
