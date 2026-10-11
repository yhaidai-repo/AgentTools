ALTER TABLE "pbi_import" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_schedule" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "pbi_import" ADD CONSTRAINT "pbi_import_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedule" ADD CONSTRAINT "task_schedule_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Settings become per vault (user decision 2026-10-05); the ones adoa had belong to its first vault.
UPDATE "config" SET "key" = 'vault:work-projects:' || "key" WHERE "key" IN ('ado', 'sync', 'import', 'importStatus', 'pullRequests', 'currentSprint', 'syncCursor');--> statement-breakpoint
-- An item under a PBI is in that PBI's vault, whoever inserts it (agents don't know about vaults).
CREATE OR REPLACE FUNCTION local_item_vault_of_pbi() RETURNS trigger AS $$
BEGIN
  IF NEW.pbi_id IS NOT NULL THEN
    SELECT vault INTO NEW.vault FROM work_item WHERE ado_id = NEW.pbi_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER local_item_vault_of_pbi BEFORE INSERT ON "local_item" FOR EACH ROW EXECUTE FUNCTION local_item_vault_of_pbi();
