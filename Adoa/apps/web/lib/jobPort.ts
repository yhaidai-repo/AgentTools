import type { JobPort } from "@adoa/core";
import { setTimeout as sleep } from "node:timers/promises";
import { getBoss } from "./boss";

const POLL_MS = 500;
const FINISHED_STATES = ["completed", "failed", "cancelled"];

// The web's way to hand work to the worker: pg-boss queues.
export const bossJobPort: JobPort = {
  async send(queue, data) {
    return (await getBoss()).send(queue, data);
  },
  async sendAndWait(queue, data, timeoutMs) {
    const jobId = await (await getBoss()).send(queue, data);

    return jobId !== null && waitForJob(queue, jobId, timeoutMs);
  },
};

async function waitForJob(queue: string, jobId: string, timeoutMs: number): Promise<boolean> {
  const boss = await getBoss();

  for (let waited = 0; waited < timeoutMs; waited += POLL_MS) {
    const state = (await boss.getJobById(queue, jobId))?.state;

    if (state && FINISHED_STATES.includes(state)) {
      return state === "completed";
    }

    await sleep(POLL_MS);
  }

  return false;
}
