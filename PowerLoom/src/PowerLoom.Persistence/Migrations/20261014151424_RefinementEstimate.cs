using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RefinementEstimate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "est_hours",
                table: "refinement",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "estimate_basis",
                table: "refinement",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "est_hours",
                table: "refinement");

            migrationBuilder.DropColumn(
                name: "estimate_basis",
                table: "refinement");
        }
    }
}
