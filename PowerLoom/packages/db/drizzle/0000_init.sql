CREATE TYPE "public"."entity_kind" AS ENUM('pbi', 'item');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('research', 'design', 'human', 'question', 'research-result');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('open', 'in-progress', 'done', 'blocked', 'cancelled', 'answered', 'dismissed', 'draft', 'final', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('new', 'refining', 'needs-research', 'researching', 'waiting-human', 'ready-for-design', 'designing', 'ready-for-dev', 'stale', 'closed');--> statement-breakpoint
CREATE TYPE "public"."repo_source" AS ENUM('agent-assumed', 'user-confirmed');--> statement-breakpoint
CREATE TYPE "public"."run_outcome" AS ENUM('running', 'success', 'no-op', 'failed', 'budget-exceeded', 'gate-rejected', 'rate-limited');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('sync', 'refinement', 'research', 'design');--> statement-breakpoint
CREATE TABLE "ado_state_change" (
	"ado_id" integer NOT NULL,
	"rev" integer NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ado_state_change_ado_id_rev_pk" PRIMARY KEY("ado_id","rev")
);
--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stage" "stage" NOT NULL,
	"pbi_id" integer,
	"item_id" text,
	"prompt_version" text,
	"model" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" "run_outcome" DEFAULT 'running' NOT NULL,
	"turns" integer,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"error" text
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design" (
	"id" serial PRIMARY KEY NOT NULL,
	"pbi_id" integer NOT NULL,
	"version" integer NOT NULL,
	"est_human_h" numeric,
	"est_agent_h" numeric,
	"complexity" smallint,
	"confidence" text,
	"risk_count" integer DEFAULT 0 NOT NULL,
	"test_count" integer DEFAULT 0 NOT NULL,
	"run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_complexity_ck" CHECK ("design"."complexity" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "local_item" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "item_kind" NOT NULL,
	"pbi_id" integer NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"status" "item_status" NOT NULL,
	"assignee" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_by_run" bigint,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pbi_repo" (
	"pbi_id" integer NOT NULL,
	"repo_id" text NOT NULL,
	"source" "repo_source" NOT NULL,
	"question_id" text,
	CONSTRAINT "pbi_repo_pbi_id_repo_id_pk" PRIMARY KEY("pbi_id","repo_id")
);
--> statement-breakpoint
CREATE TABLE "repo" (
	"id" text PRIMARY KEY NOT NULL,
	"ado_project" text NOT NULL,
	"name" text NOT NULL,
	"remote_url" text NOT NULL,
	"default_branch" text,
	"summary" text,
	"excluded" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_snapshot" (
	"iteration_path" text NOT NULL,
	"taken_on" date NOT NULL,
	"ado_id" integer NOT NULL,
	"ado_state" text NOT NULL,
	"effort" numeric,
	"remaining_work" numeric,
	CONSTRAINT "sprint_snapshot_iteration_path_taken_on_ado_id_pk" PRIMARY KEY("iteration_path","taken_on","ado_id")
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_kind" "entity_kind" NOT NULL,
	"entity_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"run_id" bigint
);
--> statement-breakpoint
CREATE TABLE "work_item" (
	"ado_id" integer PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"ado_state" text NOT NULL,
	"iteration_path" text,
	"area_path" text,
	"assigned_to" text,
	"priority" integer,
	"effort" numeric,
	"remaining_work" numeric,
	"rev" integer NOT NULL,
	"content_hash" text NOT NULL,
	"ado_changed_at" timestamp with time zone,
	"pipeline_status" "pipeline_status" DEFAULT 'new' NOT NULL,
	"out_of_scope" boolean DEFAULT false NOT NULL,
	"vault_path" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_item_id_local_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."local_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design" ADD CONSTRAINT "design_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design" ADD CONSTRAINT "design_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_item" ADD CONSTRAINT "local_item_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_item" ADD CONSTRAINT "local_item_parent_id_local_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."local_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_item" ADD CONSTRAINT "local_item_created_by_run_agent_run_id_fk" FOREIGN KEY ("created_by_run") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbi_repo" ADD CONSTRAINT "pbi_repo_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbi_repo" ADD CONSTRAINT "pbi_repo_repo_id_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbi_repo" ADD CONSTRAINT "pbi_repo_question_id_local_item_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."local_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_stage_started_idx" ON "agent_run" USING btree ("stage","started_at");--> statement-breakpoint
CREATE INDEX "agent_run_pbi_idx" ON "agent_run" USING btree ("pbi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_pbi_version_uq" ON "design" USING btree ("pbi_id","version");--> statement-breakpoint
CREATE INDEX "local_item_pbi_status_idx" ON "local_item" USING btree ("pbi_id","status");--> statement-breakpoint
CREATE INDEX "local_item_kind_status_idx" ON "local_item" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "status_history_entity_idx" ON "status_history" USING btree ("entity_kind","entity_id","at");--> statement-breakpoint
CREATE INDEX "work_item_pipeline_status_idx" ON "work_item" USING btree ("pipeline_status");--> statement-breakpoint
CREATE INDEX "work_item_iteration_idx" ON "work_item" USING btree ("iteration_path");