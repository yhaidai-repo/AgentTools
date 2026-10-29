import type { PoolClient } from "pg";
import { AGENT_ID, LEGACY_AGENT_ID } from "./legacyNames";
import type { ColumnRename } from "./models/ColumnRename";
import { tableExists } from "./tableExists";

const FENCE = "\x60\x60\x60";

// Where an older version stored the agent's id, its task type, its result kind or its output switch as plain text.
// The history of what a run said (events, prompts, notes) keeps its words; only what the pages group and filter by moves.
export const COLUMN_RENAMES: ColumnRename[] = [
  { table: "public.local_item", column: "kind", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.local_item", column: "kind", legacy: "support-guide-result", renamed: "demonstration-result", match: "equals" },
  { table: "public.local_item", column: "assignee", legacy: "agent:support-guide", renamed: "agent:demonstration", match: "equals" },
  { table: "public.agent_run", column: "stage", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.agent_prompt_version", column: "agent_id", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.agent_commit_step", column: "step_key", legacy: "writeSupportGuides:", renamed: "writeDemonstrations:", match: "prefix" },
  { table: "public.run_result", column: "agent", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.run_failure_report", column: "agent_id", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.run_failure_report", column: "tool", legacy: "write_support_guide", renamed: "write_demonstration", match: "equals" },
  { table: "public.handoff", column: "from_agent", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.estimate", column: "agent", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.bug", column: "reported_by", legacy: "agent:support-guide", renamed: "agent:demonstration", match: "equals" },
  { table: "public.status_history", column: "actor", legacy: "agent:support-guide", renamed: "agent:demonstration", match: "equals" },
  { table: "public.data_access", column: "agent_id", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.data_access", column: "tool", legacy: "write_support_guide", renamed: "write_demonstration", match: "equals" },
  { table: "public.task_schedule", column: "task_type", legacy: "support-guide", renamed: "demonstration", match: "equals" },
  { table: "public.task_schedule", column: "agent_id", legacy: "support-guide", renamed: "demonstration", match: "equals" },
];

export async function renameColumn(client: PoolClient, rename: ColumnRename): Promise<number> {
  if (!(await tableExists(client, rename.table))) {
    return 0;
  }

  const result = await client.query(updateSql(rename), [rename.legacy, rename.renamed]);

  return result.rowCount ?? 0;
}

// The usage records are labelled with the agent, which the budgets and the usage pages match on.
export async function renameUsageLabels(client: PoolClient): Promise<number> {
  if (!(await tableExists(client, "agent_usage.usage_record"))) {
    return 0;
  }

  const result = await client.query(
    "UPDATE agent_usage.usage_record SET labels = jsonb_set(labels, '{agent}', to_jsonb($2::text)) WHERE labels->>'agent' = $1",
    [LEGACY_AGENT_ID, AGENT_ID],
  );

  return result.rowCount ?? 0;
}

// Schedules copy this description into each new task, where the request parser reads its fenced input.
export async function renameScheduleDescriptions(client: PoolClient): Promise<number> {
  if (!(await tableExists(client, "public.task_schedule"))) return 0;

  const result = await client.query(
    "UPDATE public.task_schedule SET params = jsonb_set(params, '{description}', to_jsonb(replace(params->>'description', $1, $2))) WHERE task_type = 'demonstration' AND position($1 in params->>'description') > 0",
    [FENCE + "support-guide", FENCE + "demonstration"],
  );
  return result.rowCount ?? 0;
}

function updateSql(rename: ColumnRename): string {
  const { table, column } = rename;
  const narrow = rename.only ? ` AND ${rename.only}` : "";

  switch (rename.match) {
    case "equals":
      return `UPDATE ${table} SET ${column} = $2 WHERE ${column} = $1${narrow}`;
    case "prefix":
      return `UPDATE ${table} SET ${column} = $2 || substr(${column}, length($1) + 1) WHERE starts_with(${column}, $1)${narrow}`;
    case "contains":
      return `UPDATE ${table} SET ${column} = replace(${column}, $1, $2) WHERE position($1 in ${column}) > 0${narrow}`;
  }
}
