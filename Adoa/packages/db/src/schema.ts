import {
  pgTable, pgEnum, text, integer, smallint, boolean, numeric, jsonb, date,
  timestamp, bigserial, bigint, serial, primaryKey, index, uniqueIndex, check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// Enums

export const pipelineStatus = pgEnum("pipeline_status", [
  "new", "refining", "needs-research", "researching", "waiting-human",
  "ready-for-design", "designing", "ready-for-dev", "stale", "closed",
]);

export const itemKind = pgEnum("item_kind", [
  "research", "design", "human", "question", "research-result",
]);

// Allowed statuses per kind are enforced in core, not here.
export const itemStatus = pgEnum("item_status", [
  "open", "in-progress", "done", "blocked", "cancelled",
  "answered", "dismissed",
  "draft", "final", "superseded",
]);

export const entityKind = pgEnum("entity_kind", ["pbi", "item"]);

export const stage = pgEnum("stage", ["sync", "refinement", "research", "design"]);

export const runOutcome = pgEnum("run_outcome", [
  "running", "success", "no-op", "failed", "budget-exceeded", "gate-rejected", "rate-limited",
]);

export const repoSource = pgEnum("repo_source", ["agent-assumed", "user-confirmed"]);

// Settings (ADO org/project/team/user, crons, models, budgets…)

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ADO mirror + pipeline status. ADO columns are written only by sync.

export const workItem = pgTable("work_item", {
  adoId: integer("ado_id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  adoState: text("ado_state").notNull(),
  iterationPath: text("iteration_path"),
  areaPath: text("area_path"),
  assignedTo: text("assigned_to"),
  priority: integer("priority"),
  effort: numeric("effort"),
  remainingWork: numeric("remaining_work"),
  rev: integer("rev").notNull(),
  contentHash: text("content_hash").notNull(),
  adoChangedAt: ts("ado_changed_at"),
  pipelineStatus: pipelineStatus("pipeline_status").notNull().default("new"),
  outOfScope: boolean("out_of_scope").notNull().default(false),
  vaultPath: text("vault_path"),
  syncedAt: ts("synced_at").notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  index("work_item_pipeline_status_idx").on(t.pipelineStatus),
  index("work_item_iteration_idx").on(t.iterationPath),
]);

// One agent execution (or a sync run, with 0 tokens).

export const agentRun = pgTable("agent_run", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  stage: stage("stage").notNull(),
  pbiId: integer("pbi_id").references(() => workItem.adoId),
  itemId: text("item_id").references((): AnyPgColumn => localItem.id),
  promptVersion: text("prompt_version"),
  model: text("model"),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  outcome: runOutcome("outcome").notNull().default("running"),
  turns: integer("turns"),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  cacheReadTokens: bigint("cache_read_tokens", { mode: "number" }).notNull().default(0),
  cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" }).notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
  error: text("error"),
}, (t) => [
  index("agent_run_stage_started_idx").on(t.stage, t.startedAt),
  index("agent_run_pbi_idx").on(t.pbiId),
]);

// Tasks, questions, results. Ids: AT-/HT-/Q-/RR-<adoId>-<nnn>.

export const localItem = pgTable("local_item", {
  id: text("id").primaryKey(),
  kind: itemKind("kind").notNull(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  parentId: text("parent_id").references((): AnyPgColumn => localItem.id),
  title: text("title").notNull(),
  status: itemStatus("status").notNull(),
  assignee: text("assignee").notNull(), // agent:<stage> | human
  attempts: integer("attempts").notNull().default(0),
  createdByRun: bigint("created_by_run", { mode: "number" }).references((): AnyPgColumn => agentRun.id),
  vaultPath: text("vault_path"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  closedAt: ts("closed_at"),
}, (t) => [
  index("local_item_pbi_status_idx").on(t.pbiId, t.status),
  index("local_item_kind_status_idx").on(t.kind, t.status),
]);

// Every status change, written in the same transaction by core.transition().

export const statusHistory = pgTable("status_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityKind: entityKind("entity_kind").notNull(),
  entityId: text("entity_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  at: ts("at").notNull().defaultNow(),
  actor: text("actor").notNull(), // sync | agent:<stage> | human
  runId: bigint("run_id", { mode: "number" }).references(() => agentRun.id),
}, (t) => [
  index("status_history_entity_idx").on(t.entityKind, t.entityId, t.at),
]);

// Design facts for metrics; body lives in the Vault note.

export const design = pgTable("design", {
  id: serial("id").primaryKey(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  version: integer("version").notNull(),
  estHumanH: numeric("est_human_h"),
  estAgentH: numeric("est_agent_h"),
  complexity: smallint("complexity"),
  confidence: text("confidence"),
  riskCount: integer("risk_count").notNull().default(0),
  testCount: integer("test_count").notNull().default(0),
  runId: bigint("run_id", { mode: "number" }).references(() => agentRun.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("design_pbi_version_uq").on(t.pbiId, t.version),
  check("design_complexity_ck", sql`${t.complexity} between 1 and 5`),
]);

// Daily sprint snapshot for burndown.

export const sprintSnapshot = pgTable("sprint_snapshot", {
  iterationPath: text("iteration_path").notNull(),
  takenOn: date("taken_on").notNull(),
  adoId: integer("ado_id").notNull(),
  adoState: text("ado_state").notNull(),
  effort: numeric("effort"),
  remainingWork: numeric("remaining_work"),
}, (t) => [primaryKey({ columns: [t.iterationPath, t.takenOn, t.adoId] })]);

// ADO state history (from /updates) for actual cycle time.

export const adoStateChange = pgTable("ado_state_change", {
  adoId: integer("ado_id").notNull(),
  rev: integer("rev").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  changedAt: ts("changed_at").notNull(),
}, (t) => [primaryKey({ columns: [t.adoId, t.rev] })]);

// Repo catalog (org-wide) and repos a PBI touches.

export const repo = pgTable("repo", {
  id: text("id").primaryKey(), // ADO repository id
  adoProject: text("ado_project").notNull(),
  name: text("name").notNull(),
  remoteUrl: text("remote_url").notNull(),
  defaultBranch: text("default_branch"),
  summary: text("summary"),
  excluded: boolean("excluded").notNull().default(false),
  syncedAt: ts("synced_at").notNull().defaultNow(),
});

export const pbiRepo = pgTable("pbi_repo", {
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  repoId: text("repo_id").notNull().references(() => repo.id),
  source: repoSource("source").notNull(),
  questionId: text("question_id").references(() => localItem.id),
}, (t) => [primaryKey({ columns: [t.pbiId, t.repoId] })]);
