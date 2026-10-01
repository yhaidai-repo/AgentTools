CREATE TABLE "refinement" (
	"id" serial PRIMARY KEY NOT NULL,
	"pbi_id" integer NOT NULL,
	"version" integer NOT NULL,
	"run_id" bigint,
	"summary" text NOT NULL,
	"scope_in" jsonb NOT NULL,
	"scope_out" jsonb NOT NULL,
	"ac_gaps" jsonb NOT NULL,
	"dependencies" jsonb NOT NULL,
	"repos" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "refinement" ADD CONSTRAINT "refinement_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refinement" ADD CONSTRAINT "refinement_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refinement_pbi_version_uq" ON "refinement" USING btree ("pbi_id","version");--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "turns";--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "input_tokens";--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "output_tokens";--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "cache_read_tokens";--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "cache_write_tokens";--> statement-breakpoint
ALTER TABLE "agent_run" DROP COLUMN "cost_usd";