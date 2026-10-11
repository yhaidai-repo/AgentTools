import type { JobInfo } from "./models/JobInfo";

// Every pg-boss queue, who works it and what for (the Settings page's "Jobs and workers"; user decision 2026-10-06).
// Empty since phase 5 stage 5.3: every job runs in PowerLoom (the vault's adoa-backend-delivery note); phase 6 removes
// pg-boss and this catalog.
export const JOB_CATALOG: JobInfo[] = [];
