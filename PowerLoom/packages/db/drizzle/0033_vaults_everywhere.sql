ALTER TABLE "local_item" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pbi_import" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pull_request" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "task_schedule" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "work_item" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
-- The notes written so far are the first vault's; from now on the tech-writer names the vault.
ALTER TABLE "vault_note_write" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_note_write" ALTER COLUMN "vault" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vault_note_write" ADD CONSTRAINT "vault_note_write_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;