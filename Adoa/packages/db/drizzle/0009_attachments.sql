CREATE TABLE "attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"pbi_id" integer NOT NULL,
	"item_id" text,
	"source_url" text,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"text" text,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_item_id_local_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."local_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_pbi_idx" ON "attachment" USING btree ("pbi_id");