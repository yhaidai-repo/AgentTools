using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TestPipelineStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: a value can't be dropped from a PostgreSQL enum, so a database rewound to an earlier
            // migration (the drizzle adoption test) still has it. BEFORE 'done': the enum's order is the pipeline's.
            migrationBuilder.Sql("ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'ready-for-test' BEFORE 'done';");
            migrationBuilder.Sql("ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'testing' BEFORE 'done';");
            migrationBuilder.Sql("ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'tested' BEFORE 'done';");
            migrationBuilder.Sql("ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'test-failed' BEFORE 'done';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // A PostgreSQL enum value can't be dropped; rows using it would have to go first.
        }
    }
}
