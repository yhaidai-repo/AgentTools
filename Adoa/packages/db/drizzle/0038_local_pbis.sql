CREATE TYPE "public"."work_item_source" AS ENUM('ado', 'local');--> statement-breakpoint
CREATE SEQUENCE "public"."local_pbi_id" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 9000001 CACHE 1;--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "source" "work_item_source" DEFAULT 'ado' NOT NULL;