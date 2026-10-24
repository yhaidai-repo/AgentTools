ALTER TYPE "public"."vault_review_action" ADD VALUE 'close';--> statement-breakpoint
ALTER TABLE "vault_review_decision" ADD COLUMN "record_id" text;