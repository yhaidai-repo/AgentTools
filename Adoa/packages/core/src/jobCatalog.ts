import type { JobInfo } from "./models/JobInfo";
import { AGENT_RUN_QUEUE, CONFLUENCE_QUEUE, DISPATCH_QUEUE, DRAFTS_QUEUE, PBI_QUEUE, TASK_SCHEDULE_QUEUE } from "./queues";

// Every pg-boss queue, who works it and what for (the Settings page's "Jobs and workers"; user decision 2026-10-06).
// The ADO PBI sync and import, the pull request check, Prepare and Delete run in PowerLoom (the vault's
// adoa-backend-delivery note).
// Keep in step with queues.ts and the workers' main.ts.
export const JOB_CATALOG: JobInfo[] = [
  { queue: PBI_QUEUE, worker: "worker", trigger: "after an item changes", purpose: "One PBI: refresh its documents, hand-ons, status and notes." },
  { queue: DISPATCH_QUEUE, worker: "worker", trigger: "every minute (tick); each agent's cron; Run now; after an item changes", purpose: "Keeps queued PBIs current (documents, statuses, notes, hand-ons) and starts an agent's valid open tasks." },
  { queue: AGENT_RUN_QUEUE, worker: "agent-runner", trigger: "the dispatcher", purpose: "Runs one agent task (refinement, research, design, tech-writer, code review, vault review, goal) and publishes the PBI's notes." },
  { queue: DRAFTS_QUEUE, worker: "worker", trigger: "every 10 minutes", purpose: "Gives every vault draft a tech-writer task and closes tasks whose draft is gone." },
  { queue: TASK_SCHEDULE_QUEUE, worker: "worker", trigger: "each scheduled task's cron; Tasks → Create now", purpose: "Creates the schedule's task when one is needed and none waits (vault review, or any agent's goal task)." },
  { queue: CONFLUENCE_QUEUE, worker: "worker", trigger: "PBI page → Load from Confluence", purpose: "Fetches one linked Confluence page as an attachment." },
];
