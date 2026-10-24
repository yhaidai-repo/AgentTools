CREATE TABLE "skill_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"folder" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "skill_revision_name_idx" ON "skill_revision" USING btree ("name","created_at");