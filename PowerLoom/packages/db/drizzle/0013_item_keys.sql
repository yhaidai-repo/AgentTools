-- Keys for items created before item keys existed (see core itemKeys): document tasks, rejected-draft tasks, and the
-- first "Confirm repos" question per PBI and repo list. Later duplicates stay without a key.
UPDATE "local_item" SET "data" = "data" || jsonb_build_object('key', 'doc:' || ("data"->>'url'))
WHERE "kind" = 'human' AND "data" ? 'url' AND NOT "data" ? 'key';--> statement-breakpoint
UPDATE "local_item" SET "data" = "data" || jsonb_build_object('key', 'draft:' || ("data"->>'captureId'))
WHERE "data" ? 'captureId' AND NOT "data" ? 'key';--> statement-breakpoint
WITH "parsed" AS (
  SELECT "id", "pbi_id",
    'repos:' || (SELECT string_agg(trim("name"), ',' ORDER BY trim("name") COLLATE "C") FROM unnest(string_to_array(substring("body" from ': (.*)$'), ',')) AS "name") AS "key"
  FROM "local_item" WHERE "kind" = 'question' AND "body" LIKE 'Confirm repos for PBI-%'
), "ranked" AS (
  SELECT "id", "key", row_number() OVER (PARTITION BY "pbi_id", "key" ORDER BY "id") AS "n" FROM "parsed"
)
UPDATE "local_item" SET "data" = coalesce("local_item"."data", '{}'::jsonb) || jsonb_build_object('key', "ranked"."key")
FROM "ranked" WHERE "local_item"."id" = "ranked"."id" AND "ranked"."n" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "local_item_pbi_key_uq" ON "local_item" USING btree ("pbi_id",("data"->>'key')) WHERE "local_item"."data"->>'key' IS NOT NULL;
