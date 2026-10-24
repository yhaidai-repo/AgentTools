using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    // local_item.kind becomes text (user decision 2026-10-24): an agent created in the UI may handle a task type of its
    // own, which the enum never had. The enum type goes once no column uses it (the kind/status index is rebuilt by the
    // ALTER). Explicit SQL: the generated AlterColumn carried no USING cast, as in StageAsText.
    /// <inheritdoc />
    public partial class KindAsText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE local_item ALTER COLUMN kind TYPE text USING kind::text;");
            migrationBuilder.Sql("DROP TYPE IF EXISTS item_kind;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TYPE item_kind AS ENUM ('research', 'design', 'human', 'question', 'research-result', 'refinement', 'docs', 'finding',
                    'review', 'vault-review', 'goal', 'meeting', 'test', 'test-report');
                """);
            // Tasks of types the enum never named can't go back; they would have to be deleted first.
            migrationBuilder.Sql("ALTER TABLE local_item ALTER COLUMN kind TYPE item_kind USING kind::item_kind;");
        }
    }
}
