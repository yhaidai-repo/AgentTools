"use server";

import { SYNC_QUEUE } from "@adoa/core";
import { getBoss } from "@/lib/boss";
import type { ActionResult } from "@/models/ActionResult";

export async function syncNow(): Promise<ActionResult> {
  const boss = await getBoss();
  const jobId = await boss.send(SYNC_QUEUE);

  // The sync queue is exclusive: null means a sync is already queued or running.
  if (!jobId) {
    return { ok: true, message: "A sync is already queued or running." };
  }

  return { ok: true, message: "Sync queued. Refresh in a moment." };
}
