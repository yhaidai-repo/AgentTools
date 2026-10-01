import {
  pgTable, pgEnum, text, integer, smallint, boolean, numeric, jsonb, date, doublePrecision,
  timestamp, bigserial, bigint, serial, primaryKey, index, uniqueIndex, check, customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PbiSkill } from "./models/PbiSkill";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// Enums

export const pipelineStatus = pgEnum("pipeline_status", [
  "new", "ready-for-refinement", "refining", "needs-research", "researching", "waiting-human",
  "ready-for-design", "designing", "ready-for-dev", "stale", "closed",
]);

export const itemKind = pgEnum("item_kind", [
  "research", "design", "human", "question", "research-result", "refinement",
  "docs", "finding", // tech-writer task (one per vault draft), and what it found for the vault registers
]);

// Allowed statuses per kind are enforced in core, not here.
export const itemStatus = pgEnum("item_status", [
  "open", "in-progress", "done", "blocked", "cancelled",
  "answered", "dismissed",
  "draft", "final", "superseded",
  "deleted", // removed by the user: hidden everywhere, kept so agents don't create it again
]);

export const entityKind = pgEnum("entity_kind", ["pbi", "item"]);

export const stage = pgEnum("stage", ["sync", "refinement", "research", "design", "tech-writer"]);

export const runOutcome = pgEnum("run_outcome", [
  "running", "success", "no-op", "failed", "budget-exceeded", "gate-rejected", "rate-limited",
  "timeout", "aborted", "max-turns",
]);

// vault-documented: a vault project's index names the repo (`repo:` line), so refinement doesn't ask about it.
export const repoSource = pgEnum("repo_source", ["agent-assumed", "user-confirmed", "vault-documented"]);

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
  backlogPriority: doublePrecision("backlog_priority"),
  tags: text("tags"),
  effort: numeric("effort"),
  remainingWork: numeric("remaining_work"),
  rev: integer("rev").notNull(),
  contentHash: text("content_hash").notNull(),
  descriptionMd: text("description_md"),
  acceptanceCriteriaMd: text("acceptance_criteria_md"),
  adoChangedAt: ts("ado_changed_at"),
  pipelineStatus: pipelineStatus("pipeline_status").notNull().default("new"),
  outOfScope: boolean("out_of_scope").notNull().default(false),
  vaultPath: text("vault_path"),
  // App data, never written by sync. Refinement replaces the list until the user saves it (skills_edited_at set).
  skills: jsonb("skills").$type<PbiSkill[]>().notNull().default([]),
  skillsEditedAt: ts("skills_edited_at"),
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
  error: text("error"),
  // Tokens, cost and trace live in AgentUsage (schema agent_usage), keyed by this id.
  input: text("input"),
  outputs: jsonb("outputs").$type<string[]>(),
}, (t) => [
  index("agent_run_stage_started_idx").on(t.stage, t.startedAt),
  index("agent_run_pbi_idx").on(t.pbiId),
]);

// Tasks, questions, results. Ids: RT-/AT-/DT-/HT-/Q-/RR-<adoId>-<nnn>. Items assigned to `agent:<id>` are agent tasks the worker dispatches.

export const localItem = pgTable("local_item", {
  id: text("id").primaryKey(),
  kind: itemKind("kind").notNull(),
  pbiId: integer("pbi_id").references(() => workItem.adoId), // null for items no PBI is behind (e.g. a chat draft's tech-writer task)
  parentId: text("parent_id").references((): AnyPgColumn => localItem.id),
  title: text("title").notNull(),
  status: itemStatus("status").notNull(),
  assignee: text("assignee").notNull(), // agent:<stage> | human
  body: text("body"),
  data: jsonb("data"),
  resolution: text("resolution"), // the person's answer (question) or outcome note (human task)
  heldBy: jsonb("held_by").$type<string[]>().notNull().default([]), // why the dispatcher didn't start this agent task (validator reasons)
  handedOnAt: ts("handed_on_at"), // when the worker created the next agent's task after this one succeeded
  attempts: integer("attempts").notNull().default(0),
  createdByRun: bigint("created_by_run", { mode: "number" }).references((): AnyPgColumn => agentRun.id),
  vaultPath: text("vault_path"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  closedAt: ts("closed_at"),
}, (t) => [
  index("local_item_pbi_status_idx").on(t.pbiId, t.status),
  index("local_item_kind_status_idx").on(t.kind, t.status),
  // App-generated items are unique per subject (data.key); see core itemKeys.
  uniqueIndex("local_item_pbi_key_uq").on(t.pbiId, sql`(${t.data}->>'key')`).where(sql`${t.data}->>'key' IS NOT NULL`),
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

// Refinement results, one version per agent run; the Vault note is rendered from this.

export const refinement = pgTable("refinement", {
  id: serial("id").primaryKey(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  version: integer("version").notNull(),
  runId: bigint("run_id", { mode: "number" }).references(() => agentRun.id),
  summary: text("summary").notNull(),
  scopeIn: jsonb("scope_in").$type<string[]>().notNull(),
  scopeOut: jsonb("scope_out").$type<string[]>().notNull(),
  acGaps: jsonb("ac_gaps").$type<{ gap: string; suggestion: string }[]>().notNull(),
  dependencies: jsonb("dependencies").$type<string[]>().notNull(),
  repos: jsonb("repos").$type<{ name: string; reason: string }[]>().notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull(),
  // Handoff to research: docs the agent chose (path + why) and every doc it actually read.
  relevantDocs: jsonb("relevant_docs").$type<{ path: string; why: string }[]>().notNull().default([]),
  docsRead: jsonb("docs_read").$type<string[]>().notNull().default([]),
  skills: jsonb("skills").$type<{ name: string; reason: string }[]>().notNull().default([]), // what this version recommended
  createdAt: createdAt(),
}, (t) => [uniqueIndex("refinement_pbi_version_uq").on(t.pbiId, t.version)]);

// Unverified findings an agent captured for the docs vault; the worker saves them through the VaultCapture module.

export const vaultCapture = pgTable("vault_capture", {
  id: serial("id").primaryKey(),
  runId: bigint("run_id", { mode: "number" }).notNull().references(() => agentRun.id),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  itemId: text("item_id").references(() => localItem.id),
  /** VaultCapture note name: kebab-case, project-prefixed, unique in the vault. */
  name: text("name").notNull(),
  title: text("title").notNull(),
  project: text("project").notNull(),
  target: text("target").notNull(),
  captured: jsonb("captured").$type<string[]>().notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  toFill: jsonb("to_fill").$type<string[]>().notNull(),
  /** pending → created | appended | rejected (VaultCapture's result, written by the worker); created/appended → merged once gone from draft/. */
  status: text("status").notNull().default("pending"),
  errors: jsonb("errors").$type<string[]>().notNull().default([]),
  filePath: text("file_path"),
  createdAt: createdAt(),
}, (t) => [index("vault_capture_pbi_idx").on(t.pbiId)]);

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

// Files the user uploads for a PBI (e.g. a linked Confluence page), optionally answering a question or human task.
// The file and its extracted text live here so the nightly backup has them; the worker copies the file into the Vault.

export const attachment = pgTable("attachment", {
  id: serial("id").primaryKey(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  itemId: text("item_id").references(() => localItem.id),
  sourceUrl: text("source_url"), // the linked document whose content this is
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  content: bytea("content").notNull(),
  text: text("text"), // null when agents can't read it (images)
  vaultPath: text("vault_path"),
  createdAt: createdAt(),
}, (t) => [index("attachment_pbi_idx").on(t.pbiId)]);

// Earlier versions of skills edited in the web UI (the personal skills folder has no git history); newest last.

export const skillRevision = pgTable("skill_revision", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  folder: text("folder").notNull(),
  content: text("content").notNull(), // the SKILL.md as it was before a save replaced it
  savedAt: createdAt(),
}, (t) => [index("skill_revision_name_idx").on(t.name, t.savedAt)]);
