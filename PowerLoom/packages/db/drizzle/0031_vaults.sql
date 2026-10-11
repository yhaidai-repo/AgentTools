CREATE TABLE "vault" (
	"name" text PRIMARY KEY NOT NULL,
	"features" jsonb NOT NULL,
	"import_folder" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Everything adoa held before vaults became accounts belongs to the docs vault it had (DOCS_VAULT_NAME).
INSERT INTO "vault" ("name", "features") VALUES ('work-projects', '{"adoSync": true, "mailSync": true, "pullRequests": true}');--> statement-breakpoint
ALTER TABLE "local_item" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_request" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_item" ADD COLUMN "vault" text DEFAULT 'work-projects' NOT NULL;--> statement-breakpoint
ALTER TABLE "local_item" ADD CONSTRAINT "local_item_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_vault_vault_name_fk" FOREIGN KEY ("vault") REFERENCES "public"."vault"("name") ON DELETE no action ON UPDATE no action;