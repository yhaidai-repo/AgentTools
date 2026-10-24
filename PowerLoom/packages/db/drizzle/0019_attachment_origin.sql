CREATE TYPE "public"."attachment_origin" AS ENUM('upload', 'ado', 'confluence');--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "origin" "attachment_origin" DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "source_version" integer;