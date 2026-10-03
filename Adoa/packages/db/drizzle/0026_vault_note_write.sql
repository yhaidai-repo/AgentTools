CREATE TYPE "public"."note_write_action" AS ENUM('created', 'updated');--> statement-breakpoint
CREATE TABLE "vault_note_write" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"run_id" bigint NOT NULL,
	"action" "note_write_action" NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vault_note_write_path_idx" ON "vault_note_write" USING btree ("path");