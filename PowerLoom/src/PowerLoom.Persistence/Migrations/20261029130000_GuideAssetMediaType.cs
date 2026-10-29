using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GuideAssetMediaType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "media_type",
                table: "guide_asset",
                type: "text",
                nullable: false,
                defaultValue: "image/png");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "media_type",
                table: "guide_asset");
        }
    }
}
