ALTER TABLE "vault_capture" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_capture" ADD COLUMN "assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_capture" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_capture" ADD COLUMN "errors" jsonb DEFAULT '[]'::jsonb NOT NULL;