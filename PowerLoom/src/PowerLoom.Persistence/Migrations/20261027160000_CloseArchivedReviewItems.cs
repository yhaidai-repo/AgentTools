using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261027160000_CloseArchivedReviewItems")]
public sealed class CloseArchivedReviewItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE review_comment c SET status = 'withdrawn', updated_at = now()
        FROM code_review r
        WHERE r.pr_id = c.pr_id AND r.status = 'closed' AND c.status IN ('open', 'answered');

        WITH pending AS (
            SELECT i.id, i.status::text AS previous_status
            FROM local_item i JOIN code_review r ON i.data->>'prId' = r.pr_id::text
            WHERE r.status = 'closed' AND i.kind = 'review' AND i.status IN ('open', 'blocked')
            FOR UPDATE OF i
        ), cancelled AS (
            UPDATE local_item i SET status = 'cancelled', closed_at = now(), updated_at = now()
            FROM pending p WHERE i.id = p.id RETURNING i.id, p.previous_status
        )
        INSERT INTO status_history(entity_kind, entity_id, from_status, to_status, actor)
        SELECT 'item', id, previous_status, 'cancelled', 'review-close-repair' FROM cancelled;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Reopening archived work would discard the user's closure decision. History and comment text are retained.
    }
}
