using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PbiClosedByUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "closed_by_user",
                table: "work_item",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "closed_by_user",
                table: "work_item");
        }
    }
}
