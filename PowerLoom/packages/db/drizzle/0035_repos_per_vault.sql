CREATE TYPE "public"."repo_kind" AS ENUM('ado', 'local');--> statement-breakpoint
-- The catalog so far is the first vault's (user decision 2026-10-06: repositories per vault).
ALTER TABLE "repo" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
-- The saved integrations were on; the switch is new.
UPDATE "config" SET "value" = "value" || '{"enabled": true}' WHERE "key" LIKE 'vault:%:ado';--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "kind" "repo_kind" DEFAULT 'ado' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD CONSTRAINT "repo_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;