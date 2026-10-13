import {
  pgTable, pgEnum, pgSequence, text, integer, smallint, boolean, numeric, jsonb, date, doublePrecision,
  timestamp, bigserial, bigint, serial, primaryKey, index, uniqueIndex, check, customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { DesignAlternative } from "./models/DesignAlternative";
import type { DesignPlanStep } from "./models/DesignPlanStep";
import type { DesignRisk } from "./models/DesignRisk";
import type { DesignTest } from "./models/DesignTest";
import type { PbiConfluencePage } from "./models/PbiConfluencePage";
import type { PbiImportResult } from "./models/PbiImportResult";
import type { PbiSkill } from "./models/PbiSkill";
import type { VaultFeatures } from "./models/VaultFeatures";
import type { DataAccessKind } from "./models/DataAccessKind";
import type { DataAccessOutcome } from "./models/DataAccessOutcome";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// Enums

export const pipelineStatus = pgEnum("pipeline_status", [
  "new", "ready-for-refinement", "refining", "needs-research", "researching", "waiting-human",
  "ready-for-design", "designing", "ready-for-dev", "development", "done", "stale", "closed",
]);

export const itemKind = pgEnum("item_kind", [
  "research", "design", "human", "question", "research-result", "refinement",
  "docs", "finding", // tech-writer task (one per vault draft), and what it found for the vault registers
  "review", // code-review task: one review of one pull request
  "vault-review", // one review pass over the selected vaults: stale notes, invalid links
  "goal", // a scheduled task of any agent: a goal on chosen repositories, no PBI (user decision 2026-10-06)
]);

// Allowed statuses per kind are enforced in core, not here.
export const itemStatus = pgEnum("item_status", [
  "open", "in-progress", "done", "blocked", "cancelled",
  "answered", "dismissed",
  "draft", "final", "superseded",
  "deleted", // removed by the user: hidden everywhere, kept so agents don't create it again
]);

export const entityKind = pgEnum("entity_kind", ["pbi", "item"]);

export const stage = pgEnum("stage", ["sync", "refinement", "research", "design", "tech-writer", "pull-requests", "code-review", "vault-review", "better-research", "better-refinement"]);

export const runOutcome = pgEnum("run_outcome", [
  "running", "success", "no-op", "failed", "budget-exceeded", "gate-rejected", "rate-limited",
  "timeout", "aborted", "max-turns",
]);

// vault-documented: a vault project's index names the repo (`repo:` line), so refinement doesn't ask about it.
// upload: the user's own file; ado / confluence: fetched by the worker from a linked document (replaced when it changes).
export const attachmentOrigin = pgEnum("attachment_origin", ["upload", "ado", "confluence"]);

export const repoSource = pgEnum("repo_source", ["agent-assumed", "user-confirmed", "vault-documented"]);

// Where a catalog repo comes from: the vault's ADO integration, or a local checkout the user added (2026-10-06).
export const repoKind = pgEnum("repo_kind", ["ado", "local"]);

// Whether a write made a docs-vault note (it didn't exist) or changed one.
export const noteWriteAction = pgEnum("note_write_action", ["created", "updated"]);

// What the vault-review agent decided about a stale note.
export const vaultReviewAction = pgEnum("vault_review_action", ["keep", "remove", "actualize", "close"]);

export const reviewStatus = pgEnum("review_status", ["active", "closed"]);

export const reviewSeverity = pgEnum("review_severity", ["blocker", "major", "minor", "nit"]);

// answered: the user replied, the next run reads it; withdrawn: the agent took it back; outdated: the code under it changed.
export const reviewCommentStatus = pgEnum("review_comment_status", ["open", "answered", "withdrawn", "outdated"]);

// Settings (ADO org/project/team/user, crons, models, budgets…)

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// Vaults as accounts (user decision 2026-10-05): PBIs, their tasks, reviews and settings belong to one vault. The name is
// the vault's folder under the vaults root.
export const vault = pgTable("vault", {
  name: text("name").primaryKey(),
  features: jsonb("features").$type<VaultFeatures>().notNull(),
  importFolder: text("import_folder"), // folder inside the import inbox, set when mail sync is enabled
  removedAt: ts("removed_at"), // removed in Settings: PowerLoom forgets the vault, its rows keep their history
  createdAt: createdAt(),
});

const vaultName = () => text("vault").notNull().references(() => vault.name);

// Where a PBI comes from (user decision 2026-10-06): the vault's ADO sync, or created in PowerLoom (no ADO counterpart).
export const workItemSource = pgEnum("work_item_source", ["ado", "local"]);

// Ids of local PBIs, above every ADO id (assumption: ADO ids stay below 9 million).
export const localPbiId = pgSequence("local_pbi_id", { startWith: 9_000_001 });

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
  vaultPath: text("vault_path"),
  vault: vaultName(),
  source: workItemSource("source").notNull().default("ado"),
  // The PBI this item is a child of (user decision 2026-10-09): ADO's System.Parent when that PBI is in PowerLoom, or the
  // parent a local child was created under. One level: a parent is never a child itself.
  parentId: integer("parent_id").references((): AnyPgColumn => workItem.adoId),
  // App data, never written by sync. Refinement replaces the list until the user saves it (skills_edited_at set).
  skills: jsonb("skills").$type<PbiSkill[]>().notNull().default([]),
  skillsEditedAt: ts("skills_edited_at"),
  // Useful Confluence pages for the later agents: added by refinement, research and the user (links only).
  confluencePages: jsonb("confluence_pages").$type<PbiConfluencePage[]>().notNull().default([]),
  syncedAt: ts("synced_at").notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  index("work_item_pipeline_status_idx").on(t.pipelineStatus),
  index("work_item_iteration_idx").on(t.iterationPath),
  index("work_item_parent_idx").on(t.parentId),
]);

// Where a bug comes from (user decision 2026-10-09): QA's `[BUG]` Task under the PBI in ADO, or reported in PowerLoom when
// the user finds an issue after design.
export const bugSource = pgEnum("bug_source", ["ado", "internal"]);

// A bug of a PBI. Its child work item carries the content and goes through the pipeline like a PBI.
export const bug = pgTable("bug", {
  workItemId: integer("work_item_id").primaryKey().references(() => workItem.adoId),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId), // the parent PBI
  source: bugSource("source").notNull(),
  foundIn: pipelineStatus("found_in").notNull(), // the parent's pipeline status when the bug came in
  reportedBy: text("reported_by").notNull(), // sync | human | cli | agent:<stage>
  createdAt: createdAt(),
}, (t) => [index("bug_pbi_idx").on(t.pbiId)]);

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
  vault: vaultName(), // the PBI's vault (a database trigger copies it on insert); for an item without a PBI, the vault it is about
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
  // Better Refinement's full result (sources, affected areas, test data, blockers, status); null for earlier refinements.
  details: jsonb("details").$type<object | null>(),
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

// One design per run of the design agent; the latest version counts. Rendered into the Vault like the refinement.
// Estimates: human h = a developer without an agent; agent h = an agent implementing the plan (user decision 2026-10-02).

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
  approach: text("approach").notNull().default(""),
  alternatives: jsonb("alternatives").$type<DesignAlternative[]>().notNull().default([]),
  plan: jsonb("plan").$type<DesignPlanStep[]>().notNull().default([]),
  risks: jsonb("risks").$type<DesignRisk[]>().notNull().default([]),
  tests: jsonb("tests").$type<DesignTest[]>().notNull().default([]),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  estimateBasis: text("estimate_basis").notNull().default(""),
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

// PBIs deleted in PowerLoom (ADO untouched): sync skips them until the user syncs one by hand again (user decision 2026-10-02).
// Reviews deleted in PowerLoom (user decision 2026-10-06): the pull request check lists these PRs no more.
export const deletedPullRequest = pgTable("deleted_pull_request", {
  id: integer("id").primaryKey(), // ADO pull request id
  title: text("title").notNull(),
  deletedAt: ts("deleted_at").notNull().defaultNow(),
});

export const deletedPbi = pgTable("deleted_pbi", {
  adoId: integer("ado_id").primaryKey(),
  title: text("title").notNull(),
  deletedAt: ts("deleted_at").notNull().defaultNow(),
});

// PBIs brought in from a source (Outlook, a script, a future job): one row per source item, so a re-sent item isn't
// imported twice. An item with a failed PBI is imported again when re-sent.
export const pbiImport = pgTable("pbi_import", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sourceRef: text("source_ref").notNull(),
  title: text("title"),
  sender: text("sender"),
  occurredAt: ts("occurred_at"),
  vault: vaultName(),
  results: jsonb("results").$type<PbiImportResult[]>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("pbi_import_source_ref_uq").on(t.source, t.sourceRef),
  index("pbi_import_updated_idx").on(t.updatedAt),
]);

export const adoStateChange = pgTable("ado_state_change", {
  adoId: integer("ado_id").notNull(),
  rev: integer("rev").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  changedAt: ts("changed_at").notNull(),
}, (t) => [primaryKey({ columns: [t.adoId, t.rev] })]);

// Repo catalog per vault (user decision 2026-10-06) and repos a PBI touches. ADO repos come from the vault's sync; local
// ones (folders under the repos root) from Settings. `excluded` = not enabled: hidden from agents and the PBI repo choice.

export const repo = pgTable("repo", {
  id: text("id").primaryKey(), // ADO repository id, or local:<vault>:<folder>
  vault: vaultName(),
  kind: repoKind("kind").notNull().default("ado"),
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

// Azure DevOps Test Cases linked to a PBI (Tested By), as the test case tool last read them; the backend owns the table
// (migration TestCases). A case that tests several PBIs has a row per PBI.

export const testCase = pgTable("test_case", {
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  adoId: integer("ado_id").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull(),
  priority: integer("priority"),
  rev: integer("rev").notNull(),
  /** The steps as markdown (action, expected result), Shared Steps expanded in place. */
  stepsMd: text("steps_md").notNull(),
  parameters: text("parameters"),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.pbiId, t.adoId] })]);

// Files the user uploads for a PBI (e.g. a linked Confluence page), optionally answering a question or human task.
// The file and its extracted text live here so the nightly backup has them; the worker copies the file into the Vault.

export const attachment = pgTable("attachment", {
  id: serial("id").primaryKey(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  itemId: text("item_id").references(() => localItem.id),
  sourceUrl: text("source_url"), // the linked document whose content this is
  origin: attachmentOrigin("origin").notNull().default("upload"),
  sourceVersion: integer("source_version"), // the linked page's version when fetched (Confluence)
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

// Every docs-vault note the tech-writer wrote, per run (user decision 2026-10-02: the Vault page tells created from
// updated; the note's authors stamp keeps only the latest change).
export const vaultNoteWrite = pgTable("vault_note_write", {
  id: serial("id").primaryKey(),
  vault: vaultName(),
  path: text("path").notNull(), // relative to the vault root
  runId: bigint("run_id", { mode: "number" }).notNull(), // no foreign key: deleting a PBI deletes its runs, the vault keeps the note
  action: noteWriteAction("action").notNull(),
  writtenAt: ts("written_at").notNull().defaultNow(),
}, (t) => [index("vault_note_write_path_idx").on(t.path)]);

// Data access log (user decision 2026-10-13): one row per outside read an agent made through a tool (Read SQL, Read
// Azure, Confluence): who, where, the request, the outcome and counts; never the returned data. Written by the
// agent-runner; purged after DATA_ACCESS_RETENTION_DAYS.
export const dataAccess = pgTable("data_access", {
  id: serial("id").primaryKey(),
  vault: vaultName(),
  agentId: text("agent_id").notNull(),
  runId: bigint("run_id", { mode: "number" }).notNull(), // no foreign key, like vault_note_write
  taskId: text("task_id"),
  pbiId: integer("pbi_id"),
  tool: text("tool").notNull(),
  kind: text("kind").$type<DataAccessKind>().notNull(),
  resource: text("resource").notNull(), // the name Settings shows
  target: text("target").notNull(), // server/database, account, component, site
  request: text("request").notNull(), // the query, the filter, the queue, the link
  outcome: text("outcome").$type<DataAccessOutcome>().notNull(),
  reason: text("reason"),
  rows: integer("rows"),
  bytes: integer("bytes"),
  truncated: boolean("truncated").notNull().default(false),
  startedAt: ts("started_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
}, (t) => [
  index("data_access_vault_started_idx").on(t.vault, t.startedAt),
  index("data_access_resource_started_idx").on(t.resource, t.startedAt),
  index("data_access_run_idx").on(t.runId),
]);

// Scheduled tasks (user decision 2026-10-03): each row is a pg-boss schedule (key `schedule-<id>`) on the one
// `task-schedule` queue; a tick creates the agent's task through its task producer, only when one is needed.
export const taskSchedule = pgTable("task_schedule", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentId: text("agent_id").notNull(),
  vault: vaultName(), // the vault the schedule maintains (user decision 2026-10-05: configured inside the vault)
  cron: text("cron").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}), // the producer's params, e.g. { vaults: [...] }
  lastRunAt: ts("last_run_at"),
  lastResult: text("last_result"), // what the last tick did: the task it created, or why none
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// The vault-review agent's decisions (user decision 2026-10-03): a decided note drops out of its list tools for a while,
// and for as long as the tech-writer task it asked for is open.
export const vaultReviewDecision = pgTable("vault_review_decision", {
  id: serial("id").primaryKey(),
  vault: text("vault").notNull(), // folder name under the vaults root, e.g. work-projects
  path: text("path").notNull(), // relative to the vault root
  recordId: text("record_id"), // a register record (WWW/KI/OQ id) in the note at `path`; null for a decision on the note
  action: vaultReviewAction("action").notNull(),
  reasons: text("reasons").notNull(),
  noteMtime: ts("note_mtime").notNull(), // the note's mtime when decided: a later change brings it back
  taskId: text("task_id"), // the tech-writer task an `actualize` created
  runId: bigint("run_id", { mode: "number" }).notNull(), // no foreign key, like vault_note_write
  decidedAt: ts("decided_at").notNull().defaultNow(),
}, (t) => [index("vault_review_decision_note_idx").on(t.vault, t.path)]);

// Code review (user decision 2026-10-02): the ADO pull requests the Settings user reviews, PowerLoom's review of each, and the
// review's comments with the user's answers. ADO is never written; comments live here only.

export const pullRequest = pgTable("pull_request", {
  id: integer("id").primaryKey(), // ADO pull request id
  repoId: text("repo_id").notNull(),
  repoName: text("repo_name").notNull(),
  title: text("title").notNull(),
  descriptionMd: text("description_md"),
  author: text("author"),
  sourceRef: text("source_ref").notNull(),
  targetRef: text("target_ref").notNull(),
  sourceCommit: text("source_commit").notNull(),
  targetCommit: text("target_commit"),
  iteration: integer("iteration").notNull().default(1), // ADO iterations = pushes; reviewed_iteration tells how many came since
  isDraft: boolean("is_draft").notNull().default(false),
  workItemIds: jsonb("work_item_ids").$type<number[]>().notNull().default([]),
  url: text("url").notNull(),
  vault: vaultName(),
  isListed: boolean("is_listed").notNull().default(true), // false once it left the user's active PRs (completed, abandoned, not a reviewer)
  adoCreatedAt: ts("ado_created_at"),
  syncedAt: ts("synced_at").notNull().defaultNow(),
});

export const codeReview = pgTable("code_review", {
  prId: integer("pr_id").primaryKey().references(() => pullRequest.id),
  status: reviewStatus("status").notNull().default("active"),
  closedReason: text("closed_reason"),
  reviewedCommit: text("reviewed_commit"),
  reviewedIteration: integer("reviewed_iteration"),
  summaryMd: text("summary_md"),
  reviewedAt: ts("reviewed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reviewComment = pgTable("review_comment", {
  id: text("id").primaryKey(), // RC-<prId>-<nnn>
  prId: integer("pr_id").notNull().references(() => pullRequest.id),
  runId: bigint("run_id", { mode: "number" }).references(() => agentRun.id),
  commit: text("commit").notNull(), // the PR commit the comment was made on; its lines and snippet are from it
  filePath: text("file_path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  severity: reviewSeverity("severity").notNull(),
  bodyMd: text("body_md").notNull(),
  codeSnippet: text("code_snippet").notNull(),
  snippetStartLine: integer("snippet_start_line").notNull(),
  status: reviewCommentStatus("status").notNull().default("open"),
  answerMd: text("answer_md"),
  answeredAt: ts("answered_at"),
  agentReplyMd: text("agent_reply_md"), // what the agent said about the answer on its next run
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("review_comment_pr_idx").on(t.prId, t.status)]);

// Finishing a PBI (user decision 2026-10-05): how the agents did and what it cost the user; one row per finish.
export const pbiFeedback = pgTable("pbi_feedback", {
  id: serial("id").primaryKey(),
  pbiId: integer("pbi_id").notNull().references(() => workItem.adoId),
  rating: smallint("rating").notNull(), // agent performance, 1–10
  effortHours: numeric("effort_hours").notNull(), // the user's own time on the PBI
  wwwRecordId: integer("www_record_id").references(() => wwwRecord.id), // set when "what went wrong" was filled
  createdAt: createdAt(),
}, (t) => [index("pbi_feedback_pbi_idx").on(t.pbiId)]);

// WWW records PowerLoom appends to a vault's www-log.md (the www-record skill's format). The worker writes them, since only it
// writes vaults; recordId is the log's WWW-nnn once written.
export const wwwRecord = pgTable("www_record", {
  id: serial("id").primaryKey(),
  vault: text("vault").notNull(), // vault folder under the vaults root
  project: text("project").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(), // complaint | notice
  planned: text("planned").notNull(),
  happened: text("happened").notNull(),
  fault: text("fault").notNull(), // Human | Agent
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  preventiveAction: text("preventive_action"),
  assumptions: text("assumptions"),
  source: text("source").notNull(), // what created it, e.g. "PBI-34881 finish"
  recordId: text("record_id"),
  writtenAt: ts("written_at"),
  error: text("error"),
  createdAt: createdAt(),
});
