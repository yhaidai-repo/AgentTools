CREATE TYPE "public"."review_comment_status" AS ENUM('open', 'answered', 'withdrawn', 'outdated');--> statement-breakpoint
CREATE TYPE "public"."review_severity" AS ENUM('blocker', 'major', 'minor', 'nit');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('active', 'closed');--> statement-breakpoint
ALTER TYPE "public"."item_kind" ADD VALUE 'review';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'pull-requests';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'code-review';--> statement-breakpoint
CREATE TABLE "code_review" (
	"pr_id" integer PRIMARY KEY NOT NULL,
	"status" "review_status" DEFAULT 'active' NOT NULL,
	"closed_reason" text,
	"reviewed_commit" text,
	"reviewed_iteration" integer,
	"summary_md" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request" (
	"id" integer PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"repo_name" text NOT NULL,
	"title" text NOT NULL,
	"description_md" text,
	"author" text,
	"source_ref" text NOT NULL,
	"target_ref" text NOT NULL,
	"source_commit" text NOT NULL,
	"target_commit" text,
	"iteration" integer DEFAULT 1 NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"work_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"url" text NOT NULL,
	"is_listed" boolean DEFAULT true NOT NULL,
	"ado_created_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"pr_id" integer NOT NULL,
	"run_id" bigint,
	"commit" text NOT NULL,
	"file_path" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"severity" "review_severity" NOT NULL,
	"body_md" text NOT NULL,
	"code_snippet" text NOT NULL,
	"snippet_start_line" integer NOT NULL,
	"status" "review_comment_status" DEFAULT 'open' NOT NULL,
	"answer_md" text,
	"answered_at" timestamp with time zone,
	"agent_reply_md" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_review" ADD CONSTRAINT "code_review_pr_id_pull_request_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_pr_id_pull_request_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_comment_pr_idx" ON "review_comment" USING btree ("pr_id","status");