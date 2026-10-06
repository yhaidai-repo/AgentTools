import type { JobInfo } from "./models/JobInfo";
import { AGENT_RUN_QUEUE, CONFLUENCE_QUEUE, DISPATCH_QUEUE, DRAFTS_QUEUE, PBI_IMPORT_QUEUE, PBI_QUEUE, PREPARE_QUEUE, PULL_REQUESTS_QUEUE, REGISTER_QUEUE, REVIEW_NOTE_QUEUE, SYNC_QUEUE, TASK_SCHEDULE_QUEUE, VAULT_INIT_QUEUE, VAULT_TRASH_QUEUE, WWW_QUEUE } from "./queues";

// Every pg-boss queue, who works it and what for (the Settings page's "Jobs and workers"; user decision 2026-10-06).
// Keep in step with queues.ts and the workers' main.ts.
export const JOB_CATALOG: JobInfo[] = [
  { queue: SYNC_QUEUE, worker: "worker", trigger: "the vault's sync cron (ADO PBI sync on); Backlog → Sync now", purpose: "Pulls the sprint's PBIs of a vault from Azure DevOps into the database, with the repo catalog." },
  { queue: PBI_QUEUE, worker: "worker", trigger: "Backlog → Sync PBI; a PBI page's Delete; Continue with <agent>", purpose: "One PBI: sync by id, delete from adoa (data and notes), or refresh its notes." },
  { queue: PREPARE_QUEUE, worker: "worker", trigger: "Backlog / PBI page → Prepare for refinement", purpose: "Writes the PBI note from the vault template and queues a refinement task." },
  { queue: PBI_IMPORT_QUEUE, worker: "worker", trigger: "the vault's import cron (mail sync on); Backlog → Import now", purpose: "Reads the vault's import folder (Outlook mails, JSON requests), syncs the PBIs named and prepares the new ones." },
  { queue: PULL_REQUESTS_QUEUE, worker: "worker", trigger: "the vault's pull request cron (pull request sync on); Reviews → Check now", purpose: "Mirrors the active pull requests you review; a new one gets a review you start." },
  { queue: DISPATCH_QUEUE, worker: "worker", trigger: "every minute (tick); each agent's cron; Run now; after an item changes", purpose: "Keeps queued PBIs current (documents, statuses, notes, hand-ons) and starts an agent's valid open tasks." },
  { queue: AGENT_RUN_QUEUE, worker: "agent-runner", trigger: "the dispatcher", purpose: "Runs one agent task (refinement, research, design, tech-writer, code review, vault review, goal) and publishes the PBI's notes." },
  { queue: DRAFTS_QUEUE, worker: "worker", trigger: "every 10 minutes", purpose: "Gives every vault draft a tech-writer task and closes tasks whose draft is gone." },
  { queue: TASK_SCHEDULE_QUEUE, worker: "worker", trigger: "each scheduled task's cron; Tasks → Create now", purpose: "Creates the schedule's task when one is needed and none waits (vault review, or any agent's goal task)." },
  { queue: CONFLUENCE_QUEUE, worker: "worker", trigger: "PBI page → Load from Confluence", purpose: "Fetches one linked Confluence page as an attachment." },
  { queue: REGISTER_QUEUE, worker: "worker", trigger: "a finding's Submit to vault", purpose: "Adds the open question or known issue to the project's register through VaultCapture." },
  { queue: REVIEW_NOTE_QUEUE, worker: "worker", trigger: "a review's Continue with <agent>", purpose: "Writes the PR's review note into the vault's backlog before the chat opens." },
  { queue: WWW_QUEUE, worker: "worker", trigger: "Finish with \"what went wrong\"", purpose: "Appends the What-went-wrong record to the vault's www-log.md." },
  { queue: VAULT_INIT_QUEUE, worker: "worker", trigger: "Vault menu → Add vault", purpose: "Creates the vault's folder and the files adoa's maintenance needs (AGENTS.md, index, WWW log, draft/, .usage/, .obsidian/)." },
  { queue: VAULT_TRASH_QUEUE, worker: "worker", trigger: "Vault → Maintenance → Restore / Delete", purpose: "Puts a trashed note back, or deletes it for good." },
];
