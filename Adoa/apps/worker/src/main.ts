import { createWorkerBoss } from "@adoa/core";
import { requireEnv } from "./env";

// Every job moved to PowerLoom (the vault's adoa-backend-delivery note, phase 5). The worker only keeps pg-boss's
// maintenance going until phase 6 removes pg-boss, this app and the Agents page's job errors.
const boss = createWorkerBoss(requireEnv("DATABASE_URL"));

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
console.log("worker started: no jobs left (pg-boss maintenance only until phase 6)");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  await boss.stop();
  process.exit(0);
}
