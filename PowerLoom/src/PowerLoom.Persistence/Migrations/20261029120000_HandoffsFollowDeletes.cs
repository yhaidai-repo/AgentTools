using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

// Deleting a PBI or a review deletes its runs and items (PbiDeletion, ReviewDeletion), which the hand-offs point at: their
// rows go with the items, and a hand-off whose run is deleted keeps its history without the run.
[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261029120000_HandoffsFollowDeletes")]
public sealed class HandoffsFollowDeletes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE handoff DROP CONSTRAINT handoff_from_task_id_fkey, ADD CONSTRAINT handoff_from_task_id_fkey FOREIGN KEY (from_task_id) REFERENCES local_item(id) ON DELETE CASCADE;
        ALTER TABLE handoff DROP CONSTRAINT handoff_to_item_id_fkey, ADD CONSTRAINT handoff_to_item_id_fkey FOREIGN KEY (to_item_id) REFERENCES local_item(id) ON DELETE CASCADE;
        ALTER TABLE handoff DROP CONSTRAINT handoff_from_run_id_fkey, ADD CONSTRAINT handoff_from_run_id_fkey FOREIGN KEY (from_run_id) REFERENCES agent_run(id) ON DELETE SET NULL;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE handoff DROP CONSTRAINT handoff_from_task_id_fkey, ADD CONSTRAINT handoff_from_task_id_fkey FOREIGN KEY (from_task_id) REFERENCES local_item(id);
        ALTER TABLE handoff DROP CONSTRAINT handoff_to_item_id_fkey, ADD CONSTRAINT handoff_to_item_id_fkey FOREIGN KEY (to_item_id) REFERENCES local_item(id);
        ALTER TABLE handoff DROP CONSTRAINT handoff_from_run_id_fkey, ADD CONSTRAINT handoff_from_run_id_fkey FOREIGN KEY (from_run_id) REFERENCES agent_run(id);
        """);
}
