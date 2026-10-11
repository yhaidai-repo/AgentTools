CREATE TYPE "public"."vault_review_action" AS ENUM('keep', 'remove', 'actualize');--> statement-breakpoint
ALTER TYPE "public"."item_kind" ADD VALUE 'vault-review';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'vault-review';--> statement-breakpoint
CREATE TABLE "task_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_id" text NOT NULL,
	"cron" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_review_decision" (
	"id" serial PRIMARY KEY NOT NULL,
	"vault" text NOT NULL,
	"path" text NOT NULL,
	"action" "vault_review_action" NOT NULL,
	"reasons" text NOT NULL,
	"note_mtime" timestamp with time zone NOT NULL,
	"task_id" text,
	"run_id" bigint NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vault_review_decision_note_idx" ON "vault_review_decision" USING btree ("vault","path");