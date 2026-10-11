ALTER TABLE "design" ADD COLUMN "approach" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "plan" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "risks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "tests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "estimate_basis" text DEFAULT '' NOT NULL;