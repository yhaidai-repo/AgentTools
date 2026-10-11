ALTER TYPE "public"."item_kind" ADD VALUE 'docs';--> statement-breakpoint
ALTER TYPE "public"."item_kind" ADD VALUE 'finding';--> statement-breakpoint
ALTER TABLE "local_item" ALTER COLUMN "pbi_id" DROP NOT NULL;