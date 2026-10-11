CREATE TABLE "deleted_pull_request" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
