ALTER TYPE "public"."pipeline_status" ADD VALUE 'ready-for-refinement' BEFORE 'refining';--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "description_md" text;--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "acceptance_criteria_md" text;--> statement-breakpoint
-- Notes now exist only for PBIs prepared for refinement.
UPDATE "work_item" SET "vault_path" = NULL;
