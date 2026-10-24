using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    // agent_run.stage becomes text (user decision 2026-10-23): it holds the agent id, and an agent created in the UI has
    // an id the enum never had. The enum type goes once no column uses it. Explicit SQL: the generated AlterColumn
    // carried no USING cast and would have dropped the type before converting the column.
    /// <inheritdoc />
    public partial class StageAsText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE agent_run ALTER COLUMN stage TYPE text USING stage::text;");
            migrationBuilder.Sql("DROP TYPE IF EXISTS stage;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TYPE stage AS ENUM ('sync', 'refinement', 'research', 'design', 'tech-writer', 'pull-requests', 'code-review', 'vault-review',
                    'better-research', 'better-refinement', 'meeting-notes', 'better-review', 'autotest', 'custom');
                """);
            // Rows of agents the enum never named can't go back; they would have to be deleted first.
            migrationBuilder.Sql("ALTER TABLE agent_run ALTER COLUMN stage TYPE stage USING stage::stage;");
        }
    }
}
