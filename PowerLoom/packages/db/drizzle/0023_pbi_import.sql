CREATE TABLE "pbi_import" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"title" text,
	"sender" text,
	"occurred_at" timestamp with time zone,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pbi_import_source_ref_uq" ON "pbi_import" USING btree ("source","source_ref");--> statement-breakpoint
CREATE INDEX "pbi_import_updated_idx" ON "pbi_import" USING btree ("updated_at");