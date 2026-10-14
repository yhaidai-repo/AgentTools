using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WorkItemDiscussion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "discussion_md",
                table: "work_item",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "discussion_rev",
                table: "work_item",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "discussion_md",
                table: "work_item");

            migrationBuilder.DropColumn(
                name: "discussion_rev",
                table: "work_item");
        }
    }
}
