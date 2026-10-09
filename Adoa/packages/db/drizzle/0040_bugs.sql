CREATE TYPE "public"."bug_source" AS ENUM('ado', 'internal');--> statement-breakpoint
CREATE TABLE "bug" (
	"work_item_id" integer PRIMARY KEY NOT NULL,
	"pbi_id" integer NOT NULL,
	"source" "bug_source" NOT NULL,
	"found_in" "pipeline_status" NOT NULL,
	"reported_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_work_item_id_work_item_ado_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_pbi_idx" ON "bug" USING btree ("pbi_id");--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_parent_id_work_item_ado_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_parent_idx" ON "work_item" USING btree ("parent_id");