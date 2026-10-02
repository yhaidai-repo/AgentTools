CREATE TABLE "deleted_pbi" (
	"ado_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "synced_by_hand" boolean DEFAULT false NOT NULL;