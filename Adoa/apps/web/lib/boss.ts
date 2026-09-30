import { createSenderBoss } from "@adoa/core";
import type { PgBoss } from "pg-boss";

const cache = globalThis as unknown as { adoaBoss?: Promise<PgBoss> };

// Send/schedule only; the worker owns pg-boss maintenance and runs the jobs.
export function getBoss(): Promise<PgBoss> {
  cache.adoaBoss ??= startBoss();

  return cache.adoaBoss;
}

async function startBoss(): Promise<PgBoss> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const boss = createSenderBoss(url);

  boss.on("error", (error) => console.error("pg-boss:", error));
  await boss.start();

  return boss;
}
