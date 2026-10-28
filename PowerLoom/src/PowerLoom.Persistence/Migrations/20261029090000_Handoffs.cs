using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerLoom.Persistence.Migrations;

// Hand-off v1 (user decision 2026-10-28): one row per hand-off from an agent's task to the item it created for the next
// agent or a person. Items close from both the backend and the agent-runner, so the trigger keeps a hand-off's status in
// step with its target wherever the target closes.
[DbContext(typeof(PowerLoomDbContext))]
[Migration("20261029090000_Handoffs")]
public sealed class Handoffs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE handoff (
            id bigserial PRIMARY KEY,
            from_task_id text NOT NULL REFERENCES local_item(id),
            from_agent text NOT NULL,
            from_run_id bigint NULL REFERENCES agent_run(id),
            to_kind text NOT NULL CHECK (to_kind IN ('agent', 'human', 'question')),
            to_item_id text NOT NULL REFERENCES local_item(id),
            intent text NOT NULL CHECK (intent IN ('continue', 'ask', 'review', 'return')),
            gate text NOT NULL DEFAULT 'none' CHECK (gate IN ('approve', 'answer', 'none')),
            body text NOT NULL,
            refs jsonb NOT NULL DEFAULT '{"results":[],"items":[],"notes":[]}',
            status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
            created_at timestamptz NOT NULL DEFAULT now(),
            closed_at timestamptz NULL
        );
        CREATE INDEX handoff_from_task_idx ON handoff (from_task_id);
        CREATE INDEX handoff_from_run_idx ON handoff (from_run_id);
        CREATE INDEX handoff_to_item_idx ON handoff (to_item_id);

        CREATE FUNCTION handoff_follow_target() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE is_closed boolean := NEW.status::text IN ('done', 'cancelled', 'answered', 'dismissed', 'deleted');
        BEGIN
            UPDATE handoff
            SET status = CASE WHEN is_closed THEN 'closed' ELSE 'open' END,
                closed_at = CASE WHEN is_closed THEN now() ELSE NULL END
            WHERE to_item_id = NEW.id;
            RETURN NEW;
        END $$;
        CREATE TRIGGER local_item_handoff_follow_target AFTER UPDATE OF status ON local_item
        FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION handoff_follow_target();
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TRIGGER local_item_handoff_follow_target ON local_item;
        DROP FUNCTION handoff_follow_target();
        DROP TABLE handoff;
        """);
}
