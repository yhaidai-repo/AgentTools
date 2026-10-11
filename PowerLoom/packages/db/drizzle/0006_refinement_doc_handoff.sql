ALTER TABLE "refinement" ADD COLUMN "relevant_docs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "refinement" ADD COLUMN "docs_read" jsonb DEFAULT '[]'::jsonb NOT NULL;