CREATE TABLE "vault_capture" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" bigint NOT NULL,
	"pbi_id" integer NOT NULL,
	"item_id" text,
	"title" text NOT NULL,
	"project" text NOT NULL,
	"target" text NOT NULL,
	"captured" jsonb NOT NULL,
	"to_fill" jsonb NOT NULL,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_capture" ADD CONSTRAINT "vault_capture_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_capture" ADD CONSTRAINT "vault_capture_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_capture" ADD CONSTRAINT "vault_capture_item_id_local_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."local_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vault_capture_pbi_idx" ON "vault_capture" USING btree ("pbi_id");