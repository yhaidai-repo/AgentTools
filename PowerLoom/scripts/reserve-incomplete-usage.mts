// Explicit operator recovery. Dry run by default. Preserves unknown actual usage, tokens and prices.
import { writeFile } from "node:fs/promises";
import { createDb } from "../packages/db/src/index.ts";

const args = process.argv.slice(2);
const arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const runId = arg("--run"), vault = arg("--vault"), receiptPath = arg("--receipt"), reason = arg("--reason");
if (!runId || !/^\d+$/.test(runId) || !vault || !receiptPath || !reason?.trim()) throw new Error("Required: --run <id> --vault <vault> --receipt <new-file> --reason <authorization> [--apply]");
const { pool } = createDb();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows: [run] } = await client.query("SELECT r.* FROM agent_run r JOIN local_item i ON i.id=r.item_id WHERE r.id=$1 AND i.vault=$2 FOR UPDATE OF r", [runId, vault]);
  if (!run || !run.ended_at || run.outcome === "running") throw new Error("Reservation requires a finished run in this vault");
  const { rows: active } = await client.query("SELECT id FROM agent_run WHERE outcome='running'");
  if (active.length) throw new Error("An active runner must be preserved; acquire maintenance first");
  const { rows: [record] } = await client.query("SELECT * FROM agent_usage.usage_record WHERE run_id=$1 FOR UPDATE", [runId]);
  if (!record || record.accounting_complete !== false || record.budget_reservation_usd !== null) throw new Error("Requires incomplete accounting without a prior reservation");
  const { rows: phases } = await client.query("SELECT payload FROM agent_usage.run_event WHERE run_id=$1 AND type='phase' AND payload->>'name'='agent' ORDER BY seq", [runId]);
  const caps = phases.map(r => Number(r.payload.budgetUsd));
  if (!caps.length || caps.some(n => !Number.isFinite(n) || n <= 0)) throw new Error("No finite positive recorded per-run budget; explicit bounded reservation unavailable");
  const reservationUsd = Math.max(Number(record.cost_usd), caps.reduce((a, b) => a + b, 0));
  if (!Number.isFinite(reservationUsd) || reservationUsd <= 0) throw new Error("Invalid reservation");
  const receipt = { runId, vault, reason, original: record, reservationUsd, basis: "provisional-policy-charge-not-verified-provider-cost", actualAccountingRemainsIncomplete: true, applyRequested: args.includes("--apply"), at: new Date().toISOString() };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2), { flag: "wx" });
  if (args.includes("--apply")) {
    await client.query("UPDATE agent_usage.usage_record SET budget_reservation_usd=$2 WHERE run_id=$1 AND accounting_complete=false AND budget_reservation_usd IS NULL", [runId, reservationUsd]);
    await client.query("INSERT INTO agent_usage.run_event(run_id,seq,at,type,payload) SELECT $1,coalesce(max(seq),0)+1,now(),'phase',$2::jsonb FROM agent_usage.run_event WHERE run_id=$1", [runId, JSON.stringify({ name: "budget-reservation", reservationUsd, reason, accountingComplete: false })]);
  }
  await client.query(args.includes("--apply") ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify({ runId, reservationUsd, applied: args.includes("--apply"), accountingComplete: false, receipt: receiptPath }));
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
