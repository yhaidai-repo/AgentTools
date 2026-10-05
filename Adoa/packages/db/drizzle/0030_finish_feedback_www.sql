CREATE TABLE "pbi_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"pbi_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"effort_hours" numeric NOT NULL,
	"www_record_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "www_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"vault" text NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"planned" text NOT NULL,
	"happened" text NOT NULL,
	"fault" text NOT NULL,
	"root_cause" text,
	"resolution" text,
	"preventive_action" text,
	"assumptions" text,
	"source" text NOT NULL,
	"record_id" text,
	"written_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pbi_feedback" ADD CONSTRAINT "pbi_feedback_pbi_id_work_item_ado_id_fk" FOREIGN KEY ("pbi_id") REFERENCES "public"."work_item"("ado_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbi_feedback" ADD CONSTRAINT "pbi_feedback_www_record_id_www_record_id_fk" FOREIGN KEY ("www_record_id") REFERENCES "public"."www_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pbi_feedback_pbi_idx" ON "pbi_feedback" USING btree ("pbi_id");