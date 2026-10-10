import type { JobInfo } from "./models/JobInfo";
import { AGENT_RUN_QUEUE, CONFLUENCE_QUEUE, DISPATCH_QUEUE, DRAFTS_QUEUE, PBI_IMPORT_QUEUE, PBI_QUEUE, PREPARE_QUEUE, TASK_SCHEDULE_QUEUE } from "./queues";

// Every pg-boss queue, who works it and what for (the Settings page's "Jobs and workers"; user decision 2026-10-06).
// The ADO PBI sync and the pull request check run in PowerLoom (the vault's adoa-backend-delivery note).
// Keep in step with queues.ts and the workers' main.ts.
export const JOB_CATALOG: JobInfo[] = [
  { queue: PBI_QUEUE, worker: "worker", trigger: "a PBI page's Delete; after an item changes", purpose: "One PBI: delete from adoa (data and notes), or refresh its notes." },
  { queue: PREPARE_QUEUE, worker: "worker", trigger: "Backlog / PBI page → Prepare for refinement", purpose: "Writes the PBI note from the vault template and queues a refinement task." },
  { queue: PBI_IMPORT_QUEUE, worker: "worker", trigger: "the vault's import cron (mail sync on); Backlog → Import now", purpose: "Reads the vault's import folder (Outlook mails, JSON requests), syncs the PBIs named and prepares the new ones." },
  { queue: DISPATCH_QUEUE, worker: "worker", trigger: "every minute (tick); each agent's cron; Run now; after an item changes", purpose: "Keeps queued PBIs current (documents, statuses, notes, hand-ons) and starts an agent's valid open tasks." },
  { queue: AGENT_RUN_QUEUE, worker: "agent-runner", trigger: "the dispatcher", purpose: "Runs one agent task (refinement, research, design, tech-writer, code review, vault review, goal) and publishes the PBI's notes." },
  { queue: DRAFTS_QUEUE, worker: "worker", trigger: "every 10 minutes", purpose: "Gives every vault draft a tech-writer task and closes tasks whose draft is gone." },
  { queue: TASK_SCHEDULE_QUEUE, worker: "worker", trigger: "each scheduled task's cron; Tasks → Create now", purpose: "Creates the schedule's task when one is needed and none waits (vault review, or any agent's goal task)." },
  { queue: CONFLUENCE_QUEUE, worker: "worker", trigger: "PBI page → Load from Confluence", purpose: "Fetches one linked Confluence page as an attachment." },
];
