ALTER TYPE "public"."item_kind" ADD VALUE 'refinement';--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "held_by" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "handed_on_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_item" DROP COLUMN "resume_status";