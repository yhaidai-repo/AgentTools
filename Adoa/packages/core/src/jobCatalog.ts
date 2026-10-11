import type { JobInfo } from "./models/JobInfo";
import { DISPATCH_QUEUE, PBI_QUEUE } from "./queues";

// Every pg-boss queue, who works it and what for (the Settings page's "Jobs and workers"; user decision 2026-10-06).
// The ADO PBI sync and import, the pull request check, Prepare, Delete, the scheduled tasks, the item actions, the
// reviews, the repo catalog, the skills, the Confluence pages, the agents' dispatch (schedules, Run now, the runs'
// callback), the drafts scan, the linked documents and the bug prepare run in PowerLoom (the vault's
// adoa-backend-delivery note).
// Keep in step with queues.ts and the workers' main.ts.
export const JOB_CATALOG: JobInfo[] = [
  { queue: PBI_QUEUE, worker: "worker", trigger: "after an item changes", purpose: "One PBI: refresh its status and notes." },
  { queue: DISPATCH_QUEUE, worker: "worker", trigger: "every minute (tick); after an item changes", purpose: "Keeps queued PBIs current (statuses, notes)." },
];
